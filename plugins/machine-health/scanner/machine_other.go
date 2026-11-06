//go:build !darwin

package main

import "errors"

// readMachine is macOS-only in v1. Linux and Windows builds compile and stay silent, so the hook
// says nothing rather than something it has not measured (plan § Unverified 2).
func readMachine(full bool) (Machine, error) {
	return Machine{}, errors.New("machine-health: this OS is not supported yet")
}
