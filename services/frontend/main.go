package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
)

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

func main() {
	portFlag := flag.String("port", "8080", "Puerto para el servidor web de frontend")
	dirFlag := flag.String("dir", "", "Directorio de archivos estáticos")
	flag.Parse()

	port := os.Getenv("PORT")
	if port == "" {
		port = *portFlag
	}

	dir := *dirFlag
	if dir == "" {
		dir = findFrontendDir()
	}

	absDir, _ := filepath.Abs(dir)
	log.Printf("[Frontend Web] Sirviendo interfaz desde: %s", absDir)

	fs := http.FileServer(http.Dir(dir))
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
		fs.ServeHTTP(w, r)
	})

	addr := fmt.Sprintf(":%s", port)
	log.Printf("[Frontend Web] Aplicación lista en http://localhost%s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("[Frontend Web] Error en el servidor: %v", err)
	}
}
