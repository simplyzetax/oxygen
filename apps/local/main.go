package main

import (
	"crypto/tls"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	suffix   = "ol.epicgames.com"
	certPath = "./certs/_wildcard.ol.epicgames.com.pem"
	keyPath  = "./certs/_wildcard.ol.epicgames.com-key.pem"
	upstream = "http://127.0.0.1:8787"
)

func main() {
	target, err := url.Parse(upstream)
	if err != nil {
		log.Fatalf("invalid upstream url: %v", err)
	}

	proxy := httputil.NewSingleHostReverseProxy(target)
	oldDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		oldDirector(req)
		if req.Header.Get("X-Forwarded-Host") == "" {
			req.Header.Set("X-Forwarded-Host", req.Host)
		}
		if clientIP := req.RemoteAddr; clientIP != "" {
			if prior := req.Header.Get("X-Forwarded-For"); prior == "" {
				req.Header.Set("X-Forwarded-For", clientIP)
			} else {
				req.Header.Set("X-Forwarded-For", prior+", "+clientIP)
			}
		}
	}

	proxy.ModifyResponse = func(resp *http.Response) error {
		resp.Header.Del("Server")
		return nil
	}

	router := gin.New()
	router.Use(gin.Recovery(), gin.Logger())

	router.Any("*path", func(c *gin.Context) {
		if !strings.HasSuffix(c.Request.Host, suffix) {
			c.AbortWithStatus(403)
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
