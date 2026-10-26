package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"microservicios/pkg/middleware"
	"microservicios/services/productos/handlers"
	"microservicios/services/productos/repository"
)

func findDataPath(customPath string) string {
	if customPath != "" {
		return customPath
	}
	candidates := []string{
		"data/productos.json",
		"../../data/productos.json",
		"../data/productos.json",
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}
	return "data/productos.json"
}

func main() {
	portFlag := flag.String("port", "8082", "Puerto para el microservicio de productos")
	dataFlag := flag.String("data", "", "Ruta al archivo productos.json")
	flag.Parse()

	port := os.Getenv("PORT")
	if port == "" {
		port = *portFlag
	}

	dataPath := findDataPath(*dataFlag)
	absPath, _ := filepath.Abs(dataPath)
	log.Printf("[Productos Service] Iniciando con archivo de datos en: %s", absPath)

	repo, err := repository.NewProductoRepository(dataPath)
	if err != nil {
		log.Fatalf("[Productos Service] Error al inicializar repositorio: %v", err)
	}

	handler := handlers.NewProductoHandler(repo)

	mux := http.NewServeMux()
	mux.HandleFunc("/productos", handler.Router)
	mux.HandleFunc("/productos/", handler.Router)

	handlerWithCORS := middleware.EnableCORS(mux)

	addr := fmt.Sprintf(":%s", port)
	log.Printf("[Productos Service] Escuchando en http://localhost%s", addr)
	if err := http.ListenAndServe(addr, handlerWithCORS); err != nil {
		log.Fatalf("[Productos Service] Error en el servidor: %v", err)
	}
}
