package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"microservicios/pkg/middleware"
	"microservicios/services/facturacion/clients"
	"microservicios/services/facturacion/handlers"
	"microservicios/services/facturacion/repository"
)

func findDataPath(customPath string) string {
	if customPath != "" {
		return customPath
	}
	candidates := []string{
		"data/facturas.json",
		"../../data/facturas.json",
		"../data/facturas.json",
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}
	return "data/facturas.json"
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func main() {
	portFlag := flag.String("port", "8084", "Puerto para el microservicio de facturación")
	dataFlag := flag.String("data", "", "Ruta al archivo facturas.json")
	authURLFlag := flag.String("auth-url", "http://localhost:8081", "URL base del servicio de autenticación")
	clientesURLFlag := flag.String("clientes-url", "http://localhost:8083", "URL base del servicio de clientes")
	productosURLFlag := flag.String("productos-url", "http://localhost:8082", "URL base del servicio de productos")
	flag.Parse()

	port := getEnv("PORT", *portFlag)
	authURL := getEnv("AUTH_SERVICE_URL", *authURLFlag)
	clientesURL := getEnv("CLIENTES_SERVICE_URL", *clientesURLFlag)
	productosURL := getEnv("PRODUCTOS_SERVICE_URL", *productosURLFlag)

	dataPath := findDataPath(*dataFlag)
	absPath, _ := filepath.Abs(dataPath)
	log.Printf("[Facturación Service] Iniciando con archivo de datos en: %s", absPath)
	log.Printf("[Facturación Service] Conectado a Auth: %s | Clientes: %s | Productos: %s", authURL, clientesURL, productosURL)

	repo, err := repository.NewFacturaRepository(dataPath)
	if err != nil {
		log.Fatalf("[Facturación Service] Error al inicializar repositorio: %v", err)
	}

	serviceClients := clients.NewServiceClients(authURL, clientesURL, productosURL)
	handler := handlers.NewFacturaHandler(repo, serviceClients)

	mux := http.NewServeMux()
	mux.HandleFunc("/facturas", handler.Router)
	mux.HandleFunc("/facturas/", handler.Router)

	handlerWithCORS := middleware.EnableCORS(mux)

	addr := fmt.Sprintf(":%s", port)
	log.Printf("[Facturación Service] Escuchando en http://localhost%s", addr)
	if err := http.ListenAndServe(addr, handlerWithCORS); err != nil {
		log.Fatalf("[Facturación Service] Error en el servidor: %v", err)
	}
}
