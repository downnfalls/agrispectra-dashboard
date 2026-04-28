package handler

import (
	"fmt"
	"net/http"
	"sync"
	"time"

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

type ColorData struct {
	Value float64 `json:"value"`
	Diff  float64 `json:"diff"`
}

type HardwareState struct {
	Stage       string    `json:"stage"`
	LeafCount   int       `json:"leaf_count"`
	LeafDensity int       `json:"leaf_density"`
	Total       float64   `json:"total"`
	White       ColorData `json:"white"`
	Blue        ColorData `json:"blue"`
	Red         ColorData `json:"red"`
	FarRed      ColorData `json:"farRed"`
}

type HardwareHandler struct{}

func NewHardwareHandler() *HardwareHandler {
	return &HardwareHandler{}
}

// ฝั่ง ESP32 จะยิง POST โพสต์ข้อมูลมาที่นี่ (อาจจะไม่ต้องใช้ Token)
func (h *HardwareHandler) UpdateState(c *gin.Context) {
	var state HardwareState
	if err := c.ShouldBindJSON(&state); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid hardware state"})
		return
	}

	esp32StateLock.Lock()
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

// สั่งให้ ESP32 บังคับส่งข้อมูลมาใหม่
func (h *HardwareHandler) ForceRescan(c *gin.Context) {
	command := gin.H{
		"action":  "FORCE_RESCAN",
		"message": "Immediate status update requested from dashboard",
	}

	h.SendCommand(command)

	c.JSON(http.StatusOK, gin.H{"message": "Force Re-Scan command sent to hardware"})
}
