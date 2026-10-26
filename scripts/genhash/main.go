package main

import (
	"fmt"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	passwords := []string{"admin123", "cliente123", "hashed_password_123", "hashed_password_456"}
	for _, p := range passwords {
		hash, _ := bcrypt.GenerateFromPassword([]byte(p), bcrypt.DefaultCost)
		fmt.Printf("%s => %s\n", p, string(hash))
	}
}
