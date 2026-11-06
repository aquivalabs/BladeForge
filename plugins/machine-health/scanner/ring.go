package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"time"
)

const (
	ringCap      = 120
	sampleEvery  = 60 // seconds between snapshots the status command appends
	staleLock    = 10 * time.Second
	ringFileName = "ring.json"
	lockFileName = "ring.lock"
)

// dataDir is fixed rather than the plugin's own data directory: the user's status-line script calls
// the binary outside any plugin environment, and both must find the same ring.
func dataDir() string {
	if d := os.Getenv("MACHINE_HEALTH_DIR"); d != "" {
		return d
	}
	base, err := os.UserCacheDir()
	if err != nil {
		base = os.TempDir()
	}
	return filepath.Join(base, "machine-health")
}

func loadRing(dir string) []Snapshot {
	raw, err := os.ReadFile(filepath.Join(dir, ringFileName))
	if err != nil {
		return nil
	}
	var ring []Snapshot
	if json.Unmarshal(raw, &ring) != nil {
		return nil
	}
	return ring
}

// appendRing adds s under a lock and keeps the newest ringCap entries. A busy lock skips the write:
// the next sample catches up, and two sessions starting at once never interleave.
func appendRing(dir string, s Snapshot) error {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	lock := filepath.Join(dir, lockFileName)
	f, err := os.OpenFile(lock, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		if info, statErr := os.Stat(lock); statErr == nil && time.Since(info.ModTime()) > staleLock {
			os.Remove(lock)
		}
		return errors.New("ring is locked")
	}
	f.Close()
	defer os.Remove(lock)

	ring := append(loadRing(dir), s)
	if len(ring) > ringCap {
		ring = ring[len(ring)-ringCap:]
	}
	raw, err := json.Marshal(ring)
	if err != nil {
		return err
	}
	tmp := filepath.Join(dir, ringFileName+".tmp")
	if err := os.WriteFile(tmp, raw, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, filepath.Join(dir, ringFileName))
}
