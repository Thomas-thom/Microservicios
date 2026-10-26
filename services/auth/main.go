package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"microservicios/pkg/middleware"
	"microservicios/services/auth/handlers"
	"microservicios/services/auth/repository"
)

func findDataPath(customPath string) string {
	if customPath != "" {
		return customPath
	}
	candidates := []string{
		"data/usuarios.json",
		"../../data/usuarios.json",
		"../data/usuarios.json",
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}
	// Fallback a ruta absoluta basada en ejecutable o data/usuarios.json
	return "data/usuarios.json"
}

func main() {
	portFlag := flag.String("port", "8081", "Puerto para el servicio de autenticación")
	dataFlag := flag.String("data", "", "Ruta al archivo usuarios.json")
	flag.Parse()

	port := os.Getenv("PORT")
	if port == "" {
		port = *portFlag
	}

	dataPath := findDataPath(*dataFlag)
	absPath, _ := filepath.Abs(dataPath)
	log.Printf("[Auth Service] Iniciando con archivo de datos en: %s", absPath)

	repo, err := repository.NewUserRepository(dataPath)
	if err != nil {
		log.Fatalf("[Auth Service] Error al inicializar repositorio: %v", err)
	}

	authHandler := handlers.NewAuthHandler(repo)

	mux := http.NewServeMux()
	mux.HandleFunc("/register", authHandler.Register)
	mux.HandleFunc("/login", authHandler.Login)
	mux.HandleFunc("/verify", authHandler.Verify)
	mux.HandleFunc("/usuarios", authHandler.UsersHandler)
	mux.HandleFunc("/usuarios/", authHandler.UsersHandler)

	handlerWithCORS := middleware.EnableCORS(mux)

	addr := fmt.Sprintf(":%s", port)
	log.Printf("[Auth Service] Escuchando en http://localhost%s", addr)
	if err := http.ListenAndServe(addr, handlerWithCORS); err != nil {
		log.Fatalf("[Auth Service] Error en el servidor: %v", err)
	}
}
