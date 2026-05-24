package handler

import (
	"fmt"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"server/internal/models"
	"server/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var (
	esp32StateLock    sync.RWMutex
	currentESP32State *HardwareState
	clients           = make(map[*websocket.Conn]bool)          // แดชบอร์ด (Browser)
	hardwareClients   = make(map[*websocket.Conn]bool)          // ฮาร์ดแวร์ (ESP32)
	broadcast         = make(chan HardwareState)
	upgrader          = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
)

// --- Hardware LED Power Constants (from datasheet, matching Energy.jsx) ---
var maxWattsPerChannel = struct {
	White   float64
	DeepRed float64
	FarRed  float64
	Blue    float64
}{
	White:   (2.75 * 65.0 / 1000.0) * 180.0,  // White 6500K
	DeepRed: (2.0 * 700.0 / 1000.0) * 54.0,   // Deep Red 660nm
	FarRed:  (2.0 * 350.0 / 1000.0) * 18.0,   // Far Red 730nm
	Blue:    (2.975 * 350.0 / 1000.0) * 36.0,  // Royal Blue 450nm
}

type ColorData struct {
	Value float64 `json:"value"`
	Diff  float64 `json:"diff"`
	Pwm   float64 `json:"pwm"`
}

type HardwareState struct {
	Stage           string    `json:"stage"`
	LeafCount       int       `json:"leaf_count"`
	LeafDensity     int       `json:"leaf_density"`
	Total           float64   `json:"total"`
	PowerWatts      *float64  `json:"power_watts,omitempty"`
	White           ColorData `json:"white"`
	Blue            ColorData `json:"blue"`
	Red             ColorData `json:"red"`
	FarRed          ColorData `json:"farRed"`
	LastImageUrl    string    `json:"last_image_url,omitempty"`
	LastCaptureTime string    `json:"last_capture_time,omitempty"`
}

type HardwareHandler struct {
	energyRepo *repository.EnergyRepo
}

func NewHardwareHandler(energyRepo *repository.EnergyRepo) *HardwareHandler {
	return &HardwareHandler{energyRepo: energyRepo}
}

// calculateWatts returns power from ESP32 if available, otherwise calculates from PWM
func calculateWatts(state *HardwareState) float64 {
	if state == nil {
		return 0
	}
	// Prefer ESP32-reported power_watts
	if state.PowerWatts != nil {
		return math.Round(*state.PowerWatts)
	}
	// Fallback: calculate from PWM values
	watts := (maxWattsPerChannel.Blue * (state.Blue.Pwm / 100)) +
		(maxWattsPerChannel.DeepRed * (state.Red.Pwm / 100)) +
		(maxWattsPerChannel.FarRed * (state.FarRed.Pwm / 100)) +
		(maxWattsPerChannel.White * (state.White.Pwm / 100))
	return math.Round(watts)
}

// StartEnergyRecorder เริ่ม goroutine ที่บันทึกพลังงานลง DB ทุก 5 นาทีอัตโนมัติ
func (h *HardwareHandler) StartEnergyRecorder() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	fmt.Println("⚡ Energy Recorder started — recording every 5 minutes")

	for range ticker.C {
		esp32StateLock.RLock()
		state := currentESP32State
		esp32StateLock.RUnlock()

		watts := calculateWatts(state)

		// kWh for a 5-minute interval: watts × (5/60) / 1000
		kwh := (watts * (5.0 / 60.0)) / 1000.0
		kwh = math.Round(kwh*1000000) / 1000000 // round to 6 decimal places

		now := time.Now()
		date := now.Format("2006-01-02")
		hour := now.Hour()

		record := &models.EnergyRecord{
			Date: date,
			Hour: hour,
			Kwh:  kwh,
		}

		if err := h.energyRepo.UpsertHourly(record); err != nil {
			fmt.Printf("❌ Failed to record energy: %v\n", err)
		} else {
			fmt.Printf("⚡ Recorded %.6f kWh for %s hour %d (%.0fW)\n", kwh, date, hour, watts)
		}
	}
}

// ฝั่ง ESP32 จะยิง POST โพสต์ข้อมูลมาที่นี่ (อาจจะไม่ต้องใช้ Token)
func (h *HardwareHandler) UpdateState(c *gin.Context) {
	var state HardwareState
	if err := c.ShouldBindJSON(&state); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid hardware state"})
		return
	}

	esp32StateLock.Lock()
	if currentESP32State != nil {
		state.LastImageUrl = currentESP32State.LastImageUrl
		state.LastCaptureTime = currentESP32State.LastCaptureTime
	}
	currentESP32State = &state
	esp32StateLock.Unlock()

	// พ่นข้อมูลลงท่อ Broadcast
	broadcast <- state

	c.JSON(http.StatusOK, gin.H{"message": "Hardware state updated"})
}

func (h *HardwareHandler) HandleMessages() {
	for {
		// รอรับข้อมูลจากช่อง broadcast
		msg := <-broadcast
		
		esp32StateLock.Lock()
		for client := range clients {
			err := client.WriteJSON(msg)
			if err != nil {
				client.Close()
				delete(clients, client)
			}
		}
		esp32StateLock.Unlock()
	}
}

func (h *HardwareHandler) ConnectWebSocket(c *gin.Context) {
	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	esp32StateLock.Lock()
	clients[ws] = true
	esp32StateLock.Unlock()

	// ส่งข้อมูลล่าสุดให้ทันทีที่ต่อสาย (ถ้ามี)
	esp32StateLock.RLock()
	state := currentESP32State
	count := len(hardwareClients)
	esp32StateLock.RUnlock()

	status := "OFFLINE"
	if count > 0 {
		status = "ONLINE"
	}

	ws.WriteJSON(gin.H{
		"type":   "connection_status",
		"status": status,
	})

	if state != nil {
		ws.WriteJSON(state)
	}

	// Add read loop to keep the connection alive and handle client disconnect
	go func() {
		defer func() {
			esp32StateLock.Lock()
			delete(clients, ws)
			esp32StateLock.Unlock()
			ws.Close()
		}()
		for {
			if _, _, err := ws.NextReader(); err != nil {
				break
			}
		}
	}()
}

func (h *HardwareHandler) broadcastConnectionStatus() {
	esp32StateLock.RLock()
	count := len(hardwareClients)
	esp32StateLock.RUnlock()

	status := "OFFLINE"
	if count > 0 {
		status = "ONLINE"
	}

	msg := gin.H{
		"type":   "connection_status",
		"status": status,
	}

	esp32StateLock.Lock()
	for client := range clients {
		client.WriteJSON(msg)
	}
	esp32StateLock.Unlock()
}

// ฝั่ง ESP32 จะเชื่อมต่อมาที่นี่เพื่อรอรับคำสั่ง (Profile, Control)
func (h *HardwareHandler) ConnectCommandWS(c *gin.Context) {
	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	esp32StateLock.Lock()
	hardwareClients[ws] = true
	total := len(hardwareClients)
	esp32StateLock.Unlock()

	h.broadcastConnectionStatus()

	clientIP := c.ClientIP()
	fmt.Printf("🛰 [Hardware] ESP32 Connected! IP: %s | Total Active Devices: %d\n", clientIP, total)

	// สร้าง Goroutine มารอฟังการตัดการเชื่อมต่อ (ถ้า ESP32 หายไปจะได้รู้ทันที)
	
	// ล็อกเวลาถ้าไม่มี Ping-Pong (ตัดการเชื่อมต่ออัตโนมัติภายใน 15 วินาทีถ้าไม่ได้ PONG)
	ws.SetReadDeadline(time.Now().Add(15 * time.Second))
	ws.SetPongHandler(func(string) error {
		ws.SetReadDeadline(time.Now().Add(15 * time.Second))
		return nil
	})

	// Ticker Goroutine สำหรับส่ง PING ไปหา ESP32 ทุกๆ 10 วินาที
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			esp32StateLock.Lock()
			if _, exists := hardwareClients[ws]; !exists {
				esp32StateLock.Unlock()
				break
			}
			err := ws.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(time.Second))
			esp32StateLock.Unlock()

			if err != nil {
				// ส่งขัดข้องแปลว่าสายหลุด
				break
			}
		}
	}()

	go func() {
		for {
			// อ่านเพื่อเช็คว่าสายยังอยู่ไหม (และรอรับ Pong)
			if _, _, err := ws.NextReader(); err != nil {
				esp32StateLock.Lock()
				if _, exists := hardwareClients[ws]; exists {
					delete(hardwareClients, ws)
					fmt.Printf("❌ [Hardware] ESP32 Disconnected! IP: %s | Remaining Devices: %d\n", clientIP, len(hardwareClients))
				}
				esp32StateLock.Unlock()

				h.broadcastConnectionStatus()
				ws.Close()
				break
			}
		}
	}()
}


// ใช้สำหรับส่งข้อมูล (JSON) ไปยัง ESP32 ทุกตัวที่ต่อสายอยู่
func (h *HardwareHandler) SendCommand(command interface{}) {
	esp32StateLock.Lock()
	defer esp32StateLock.Unlock()

	for client := range hardwareClients {
		err := client.WriteJSON(command)
		if err != nil {
			fmt.Printf("❌ Failed to send command to ESP32: %v\n", err)
			client.Close()
			delete(hardwareClients, client)
		} else {
			fmt.Println("🚀 Command pushed to ESP32 successfully")
		}
	}
}

// ฝั่ง Dashboard (React) จะยิง GET มาดึงข้อมูล
func (h *HardwareHandler) GetState(c *gin.Context) {
	esp32StateLock.RLock()
	state := currentESP32State
	esp32StateLock.RUnlock()

	if state == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No data available"})
		return
	}

	c.JSON(http.StatusOK, state)
}

// สั่งหยุดทำงานฉุกเฉิน (ปิดไฟ/ระบบ)
func (h *HardwareHandler) EmergencyStop(c *gin.Context) {
	command := gin.H{
		"action":  "EMERGENCY_STOP",
		"message": "Immediate shutdown requested from dashboard",
	}

	h.SendCommand(command)

	c.JSON(http.StatusOK, gin.H{"message": "Emergency Stop command sent to hardware"})
}

// สั่ง Reset ระบบ ESP32
func (h *HardwareHandler) Reset(c *gin.Context) {
	command := gin.H{
		"action":  "RESET",
		"message": "System reset requested from dashboard",
	}

	h.SendCommand(command)

	c.JSON(http.StatusOK, gin.H{"message": "Reset command sent to hardware"})
}

// สั่งให้ ESP32 บังคับส่งข้อมูลมาใหม่
func (h *HardwareHandler) ForceRescan(c *gin.Context) {
	command := gin.H{
		"action":  "FORCE_RESCAN",
		"message": "Immediate status update requested from dashboard",
	}

	h.SendCommand(command)

	c.JSON(http.StatusOK, gin.H{"message": "Force Re-Scan command sent to hardware"})
}

// อัปโหลดรูปภาพจาก ESP32
func (h *HardwareHandler) UploadImage(c *gin.Context) {
	// รับไฟล์จาก form data ชื่อ "image"
	file, err := c.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No image file provided"})
		return
	}

	// สร้างโฟลเดอร์ uploads/images ถ้ายังไม่มี
	uploadDir := "uploads/images"
	if err := os.MkdirAll(uploadDir, os.ModePerm); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	// สร้างชื่อไฟล์ใหม่ เช่น scan_1680000000.jpg
	ext := filepath.Ext(file.Filename)
	if ext == "" {
		ext = ".jpg" // default extension
	}
	filename := fmt.Sprintf("scan_%d%s", time.Now().Unix(), ext)
	savePath := filepath.Join(uploadDir, filename)

	// บันทึกไฟล์
	if err := c.SaveUploadedFile(file, savePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save image"})
		return
	}

	// URL สำหรับเข้าถึงรูปภาพ
	imageUrl := fmt.Sprintf("/uploads/images/%s", filename)
	captureTime := time.Now().Format("Jan 02, 2006 - 15:04:05")

	esp32StateLock.Lock()
	if currentESP32State == nil {
		currentESP32State = &HardwareState{}
	}
	currentESP32State.LastImageUrl = imageUrl
	currentESP32State.LastCaptureTime = captureTime
	esp32StateLock.Unlock()

	// แจ้งเตือนไปยัง Web Socket แดชบอร์ดว่ามีรูปภาพใหม่ (เผื่อต้องการให้แดชบอร์ดอัปเดตอัตโนมัติ)
	msg := gin.H{
		"type": "new_image",
		"url":  imageUrl,
	}

	esp32StateLock.Lock()
	for client := range clients {
		client.WriteJSON(msg)
	}
	esp32StateLock.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"message": "Image uploaded successfully",
		"url":     imageUrl,
	})
}
