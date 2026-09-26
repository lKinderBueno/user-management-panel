package util

import (
	"context"
	"crypto/rand"
	"math/big"
)

type UsernameChecker interface {
	IsUsernameTaken(ctx context.Context, username string, excludeListID uint64, excludeID int) (bool, error)
}

type M3UChecker interface {
	IsM3UTaken(ctx context.Context, m3u string, excludeListID uint64, excludeID int) (bool, error)
}

type EPGChecker interface {
	IsEPGTaken(ctx context.Context, epg string, excludeListID uint64, excludeID int) (bool, error)
}


const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnopqrstuvwxyz123456789"

func RandomText(baseLength int, variance int) string {
	length := baseLength
	if variance > 0 {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(variance)))
		if err == nil {
			length += int(n.Int64())
		}
	}

	result := make([]byte, length)
	charsetLen := big.NewInt(int64(len(charset)))
	for i := 0; i < length; i++ {
		idx, err := rand.Int(rand.Reader, charsetLen)
		if err != nil {
			result[i] = charset[0]
		} else {
			result[i] = charset[idx.Int64()]
		}
	}
	return string(result)
}

func GenerateUniqueUsername(ctx context.Context, repo UsernameChecker) (string, error) {
	for {
		str := RandomText(10, 3)
		taken, err := repo.IsUsernameTaken(ctx, str, 0, 0)
		if err != nil {
			return "", err
		}
		if !taken {
			return str, nil
		}
	}
}

func GenerateUniqueM3U(ctx context.Context, repo M3UChecker) (string, error) {
	for {
		str := RandomText(11, 4)
		taken, err := repo.IsM3UTaken(ctx, str, 0, 0)
		if err != nil {
			return "", err
		}
		if !taken {
			return str, nil
		}
	}
}

func GenerateUniqueEPG(ctx context.Context, repo EPGChecker) (string, error) {
	for {
		str := RandomText(14, 4)
		taken, err := repo.IsEPGTaken(ctx, str, 0, 0)
		if err != nil {
			return "", err
		}
		if !taken {
			return str, nil
		}
	}
}


func GenerateRandomPassword() string {
	return RandomText(10, 4)
}
