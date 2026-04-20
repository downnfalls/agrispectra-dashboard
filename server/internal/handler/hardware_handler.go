package handler

import (
	"fmt"
	"net/http"
	"sync"
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
	if currentESP32State != nil {
		ws.WriteJSON(currentESP32State)
	}
	esp32StateLock.RUnlock()
}

// ฝั่ง ESP32 จะเชื่อมต่อมาที่นี่เพื่อรอรับคำสั่ง (Profile, Control)
func (h *HardwareHandler) ConnectCommandWS(c *gin.Context) {
	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	esp32StateLock.Lock()
	hardwareClients[ws] = true
	esp32StateLock.Unlock()

	fmt.Println("🛰 [Hardware] ESP32 Connected to Command Channel")
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
