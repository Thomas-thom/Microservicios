package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"microservicios/pkg/middleware"
	"microservicios/services/clientes/handlers"
	"microservicios/services/clientes/repository"
)

func findDataPath(customPath string) string {
	if customPath != "" {
		return customPath
	}
	candidates := []string{
		"data/clientes.json",
		"../../data/clientes.json",
		"../data/clientes.json",
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}
	return "data/clientes.json"
}

func main() {
	portFlag := flag.String("port", "8083", "Puerto para el microservicio de clientes")
	dataFlag := flag.String("data", "", "Ruta al archivo clientes.json")
	flag.Parse()

	port := os.Getenv("PORT")
	if port == "" {
		port = *portFlag
	}

	dataPath := findDataPath(*dataFlag)
	absPath, _ := filepath.Abs(dataPath)
	log.Printf("[Clientes Service] Iniciando con archivo de datos en: %s", absPath)

	repo, err := repository.NewClienteRepository(dataPath)
	if err != nil {
		log.Fatalf("[Clientes Service] Error al inicializar repositorio: %v", err)
	}

	handler := handlers.NewClienteHandler(repo)

	mux := http.NewServeMux()
	mux.HandleFunc("/clientes", handler.Router)
	mux.HandleFunc("/clientes/", handler.Router)

	handlerWithCORS := middleware.EnableCORS(mux)

	addr := fmt.Sprintf(":%s", port)
	log.Printf("[Clientes Service] Escuchando en http://localhost%s", addr)
	if err := http.ListenAndServe(addr, handlerWithCORS); err != nil {
		log.Fatalf("[Clientes Service] Error en el servidor: %v", err)
	}
}
