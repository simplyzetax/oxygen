package main

import (
	"crypto/tls"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

const (
	suffix   = "ol.epicgames.com"
	certPath = "./certs/_wildcard.ol.epicgames.com.pem"
	keyPath  = "./certs/_wildcard.ol.epicgames.com-key.pem"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	upstream := os.Getenv("BACKEND_URL")
	if upstream == "" {
		upstream = "https://backend.zetax.workers.dev"
	}

	target, err := url.Parse(upstream)
	if err != nil {
		log.Fatalf("invalid upstream url: %v", err)
	}

	proxy := httputil.NewSingleHostReverseProxy(target)
	oldDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		oldDirector(req)

		// Always set the backend secret for authentication
		req.Header.Set("X-Backend-Key", os.Getenv("BACKEND_SECRET"))

		// Preserve original requested host for your Worker
		originalHost := req.Host
		if req.Header.Get("X-Epic-URL") == "" {
			req.Header.Set("X-Epic-URL", originalHost)
		}

		// Important: ensure Host header matches the upstream zone to prevent 403s
		req.Host = target.Host
		req.Header.Set("Host", target.Host)
	}

	proxy.ModifyResponse = func(resp *http.Response) error {
		resp.Header.Del("Server")
		return nil
	}

	router := gin.New()
	router.Use(gin.Recovery(), gin.Logger())

	router.Any("*path", func(c *gin.Context) {
		// Reject requests that don’t end with your wildcard domain
		if !strings.HasSuffix(c.Request.Host, suffix) {
			c.AbortWithStatus(http.StatusForbidden)
			return
		}
		proxy.ServeHTTP(c.Writer, c.Request)
	})

	cert, err := tls.LoadX509KeyPair(certPath, keyPath)
	if err != nil {
		log.Fatalf("failed to load cert/key: %v", err)
	}

	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{cert},
		MinVersion:   tls.VersionTLS12,
	}

	srv := &http.Server{
		Addr:      "127.0.0.1:443",
		Handler:   router,
		TLSConfig: tlsConfig,
	}

	log.Printf("Proxy listening on https://%s and forwarding to %s", srv.Addr, upstream)
	log.Fatal(srv.ListenAndServeTLS("", ""))
}
