package main

import (
	"bufio"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"os/signal"
	"syscall"
)

type Service struct {
	Name string
	Path string
	Port string
}

func main() {
	services := []Service{
		{Name: "AUTH-8081", Path: "./services/auth", Port: "8081"},
		{Name: "PRODUCTOS-8082", Path: "./services/productos", Port: "8082"},
		{Name: "CLIENTES-8083", Path: "./services/clientes", Port: "8083"},
		{Name: "FACTURACION-8084", Path: "./services/facturacion", Port: "8084"},
		{Name: "FRONTEND-8080", Path: "./services/frontend", Port: "8080"},
	}

	fmt.Println("==================================================================")
	fmt.Println("      INICIANDO SISTEMA DE FACTURACIÓN DIGITAL - MICROSERVICIOS   ")
	fmt.Println("==================================================================")

	var cmds []*exec.Cmd

	for _, s := range services {
		cmd := exec.Command("go", "run", s.Path)
		cmd.Env = append(os.Environ(), fmt.Sprintf("PORT=%s", s.Port))

		stdout, err := cmd.StdoutPipe()
		if err != nil {
			log.Fatalf("Error al capturar stdout de %s: %v", s.Name, err)
		}
		stderr, err := cmd.StderrPipe()
		if err != nil {
			log.Fatalf("Error al capturar stderr de %s: %v", s.Name, err)
		}

		go pipeOutput(s.Name, stdout)
		go pipeOutput(s.Name, stderr)

		if err := cmd.Start(); err != nil {
			log.Fatalf("Error al arrancar servicio %s: %v", s.Name, err)
		}
		cmds = append(cmds, cmd)
		fmt.Printf("[OK] Servicio %-16s iniciado en puerto %s\n", s.Name, s.Port)
	}

	fmt.Println("------------------------------------------------------------------")
	fmt.Println("Frontend disponible en: http://localhost:8080")
	fmt.Println("Presiona Ctrl+C para detener todos los microservicios.")
	fmt.Println("------------------------------------------------------------------")

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	<-sigChan

	fmt.Println("\nDeteniendo microservicios...")
	for _, cmd := range cmds {
		if cmd != nil && cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
	}
	fmt.Println("Todos los servicios han sido detenidos.")
}

func pipeOutput(prefix string, reader io.Reader) {
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		fmt.Printf("[%s] %s\n", prefix, scanner.Text())
	}
}
