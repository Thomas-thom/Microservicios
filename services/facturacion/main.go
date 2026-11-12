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

func findFrontendDir() string {
	candidates := []string{
		"frontend",
		"../../frontend",
		"../frontend",
	}
	for _, c := range candidates {
		if fi, err := os.Stat(c); err == nil && fi.IsDir() {
			return c
		}
	}
	return "frontend"
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
	log.Printf("[Servicio General de Facturación] Iniciando con archivo de datos en: %s", absPath)
	log.Printf("[Servicio General de Facturación] Orquestando -> Auth: %s | Productos: %s | Clientes: %s", authURL, productosURL, clientesURL)

	repo, err := repository.NewFacturaRepository(dataPath)
	if err != nil {
		log.Fatalf("[Facturación Service] Error al inicializar repositorio: %v", err)
	}

	serviceClients := clients.NewServiceClients(authURL, clientesURL, productosURL)
	handler := handlers.NewFacturaHandler(repo, serviceClients)

	frontendDir := findFrontendDir()
	absFrontendDir, _ := filepath.Abs(frontendDir)
	fs := http.FileServer(http.Dir(frontendDir))

	mux := http.NewServeMux()
	mux.HandleFunc("/facturas", handler.Router)
	mux.HandleFunc("/facturas/", handler.Router)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
		fs.ServeHTTP(w, r)
	})

	handlerWithCORS := middleware.EnableCORS(mux)

	// Si se corre en modo de 4 ventanas de CMD (sin el 5to servicio frontend separado),
	// también habilitamos automáticamente el puerto :8080 para la interfaz web.
	if port != "8080" {
		go func() {
			webMux := http.NewServeMux()
			webMux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
				fs.ServeHTTP(w, r)
			})
			log.Printf("[Interfaz Web Integrada] Sirviendo cliente JS/React desde %s en http://localhost:8080 y http://localhost:%s", absFrontendDir, port)
			_ = http.ListenAndServe(":8080", webMux)
		}()
	}

	addr := fmt.Sprintf(":%s", port)
	log.Printf("[Servicio General de Facturación] API y Web escuchando en http://localhost%s", addr)
	if err := http.ListenAndServe(addr, handlerWithCORS); err != nil {
		log.Fatalf("[Facturación Service] Error en el servidor: %v", err)
	}
}
