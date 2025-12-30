package main

import (
	context "context"
	crypto_rand "crypto/rand"
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/hex"
	"errors"
	"math/big"
	"net"
	"strings"

	"github.com/cloudflare/circl/sign/bls12381"
	blake3 "github.com/zeebo/blake3"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/structpb"
)

type CryptoPrimitivesServer interface {
	Hash(context.Context, *structpb.Struct) (*structpb.Struct, error)
	VerifyHash(context.Context, *structpb.Struct) (*structpb.Struct, error)
	MerkleRoot(context.Context, *structpb.Struct) (*structpb.Struct, error)
	MerkleProof(context.Context, *structpb.Struct) (*structpb.Struct, error)
	VerifyMerkleProof(context.Context, *structpb.Struct) (*structpb.Struct, error)
	Ed25519Keygen(context.Context, *structpb.Struct) (*structpb.Struct, error)
	Ed25519Sign(context.Context, *structpb.Struct) (*structpb.Struct, error)
	Ed25519Verify(context.Context, *structpb.Struct) (*structpb.Struct, error)
	RandomBytes(context.Context, *structpb.Struct) (*structpb.Struct, error)
	RandomInt(context.Context, *structpb.Struct) (*structpb.Struct, error)
	BLSKeygen(context.Context, *structpb.Struct) (*structpb.Struct, error)
	BLSSign(context.Context, *structpb.Struct) (*structpb.Struct, error)
	BLSVerify(context.Context, *structpb.Struct) (*structpb.Struct, error)
}

type server struct{}

func decodeInput(in *structpb.Struct, key string, def string) string {
	if v, ok := in.Fields[key]; ok {
		if s, ok := v.Kind.(*structpb.Value_StringValue); ok {
			return s.StringValue
		}
	}
	return def
}

func decodeInt(in *structpb.Struct, key string, def int) int {
	if v, ok := in.Fields[key]; ok {
		switch t := v.Kind.(type) {
		case *structpb.Value_NumberValue:
			return int(t.NumberValue)
		case *structpb.Value_StringValue:
			if n, ok := new(big.Int).SetString(t.StringValue, 10); ok {
				return int(n.Int64())
			}
		}
	}
	return def
}

func hashBytes(data []byte, algorithm string) (string, error) {
	switch strings.ToUpper(algorithm) {
	case "SHA-256":
		sum := sha256.Sum256(data)
		return hex.EncodeToString(sum[:]), nil
	case "SHA-384":
		sum := sha512.Sum384(data)
		return hex.EncodeToString(sum[:]), nil
	case "SHA-512":
		sum := sha512.Sum512(data)
		return hex.EncodeToString(sum[:]), nil
	case "BLAKE3":
		sum := blake3.Sum256(data)
		return hex.EncodeToString(sum[:]), nil
	default:
		return "", errors.New("unsupported algorithm")
	}
}

func decodeData(raw string, encoding string) ([]byte, error) {
	if strings.ToLower(encoding) == "hex" {
		return hex.DecodeString(strings.TrimPrefix(raw, "0x"))
	}
	return []byte(raw), nil
}

func (s *server) Hash(ctx context.Context, in *structpb.Struct) (*structpb.Struct, error) {
	dataRaw := decodeInput(in, "data", "")
	algo := decodeInput(in, "algorithm", "SHA-256")
	enc := decodeInput(in, "encoding", "utf8")
	data, err := decodeData(dataRaw, enc)
	if err != nil {
		return nil, err
	}
	h, err := hashBytes(data, algo)
	if err != nil {
		return nil, err
	}
	return structpb.NewStruct(map[string]*structpb.Value{"hash": structpb.NewStringValue(h)}), nil
}

func (s *server) VerifyHash(ctx context.Context, in *structpb.Struct) (*structpb.Struct, error) {
	dataRaw := decodeInput(in, "data", "")
	expected := decodeInput(in, "expectedHash", "")
	algo := decodeInput(in, "algorithm", "SHA-256")
	enc := decodeInput(in, "encoding", "utf8")
	data, err := decodeData(dataRaw, enc)
	if err != nil {
		return nil, err
	}
	h, err := hashBytes(data, algo)
	if err != nil {
		return nil, err
	}
	return structpb.NewStruct(map[string]*structpb.Value{"valid": structpb.NewBoolValue(strings.EqualFold(h, expected))}), nil
}

func merklePair(a, b []byte, algo string) ([]byte, error) {
	buf := append(a, b...)
	h, err := hashBytes(buf, algo)
	if err != nil {
		return nil, err
	}
	return hex.DecodeString(h)
}

func merkleRootLeaves(leaves [][]byte, algo string) (string, error) {
	if len(leaves) == 0 {
		return "", errors.New("no leaves")
	}
	level := leaves
	for len(level) > 1 {
		next := [][]byte{}
		for i := 0; i < len(level); i += 2 {
			if i+1 == len(level) {
				next = append(next, level[i])
				continue
			}
			h, err := merklePair(level[i], level[i+1], algo)
			if err != nil {
				return "", err
			}
			next = append(next, h)
		}
		level = next
	}
	return hex.EncodeToString(level[0]), nil
}

func (s *server) MerkleRoot(ctx context.Context, in *structpb.Struct) (*structpb.Struct, error) {
	algo := decodeInput(in, "algorithm", "SHA-256")
	enc := decodeInput(in, "encoding", "utf8")
	leavesVal, ok := in.Fields["leaves"]
	if !ok {
		return nil, errors.New("leaves required")
	}
	lv := leavesVal.GetListValue()
	if lv == nil {
		return nil, errors.New("leaves must be list")
	}
	leaves := [][]byte{}
	for _, v := range lv.Values {
		leaf := v.GetStringValue()
		b, err := decodeData(leaf, enc)
		if err != nil {
			return nil, err
		}
		leaves = append(leaves, b)
	}
	root, err := merkleRootLeaves(leaves, algo)
	if err != nil {
		return nil, err
	}
	return structpb.NewStruct(map[string]*structpb.Value{"root": structpb.NewStringValue(root)}), nil
}

type proofStep struct {
	Sibling string `json:"sibling"`
	Left    bool   `json:"left"`
}

func merkleProof(leaves [][]byte, index int, algo string) ([]proofStep, string, error) {
	if index < 0 || index >= len(leaves) {
		return nil, "", errors.New("invalid index")
	}
	level := leaves
	idx := index
	proof := []proofStep{}
	for len(level) > 1 {
		next := [][]byte{}
		for i := 0; i < len(level); i += 2 {
			var left, right []byte
			left = level[i]
			if i+1 < len(level) {
				right = level[i+1]
			} else {
				right = left
			}
			h, err := merklePair(left, right, algo)
			if err != nil {
				return nil, "", err
			}
			next = append(next, h)
			if i == idx || i+1 == idx {
				if i == idx {
					proof = append(proof, proofStep{Sibling: hex.EncodeToString(right), Left: false})
				} else {
					proof = append(proof, proofStep{Sibling: hex.EncodeToString(left), Left: true})
				}
				idx = len(next) - 1
			}
		}
		level = next
	}
	return proof, hex.EncodeToString(level[0]), nil
}

func (s *server) MerkleProof(ctx context.Context, in *structpb.Struct) (*structpb.Struct, error) {
	algo := decodeInput(in, "algorithm", "SHA-256")
	enc := decodeInput(in, "encoding", "utf8")
	index := decodeInt(in, "leafIndex", 0)
	leavesVal, ok := in.Fields["leaves"]
	if !ok {
		return nil, errors.New("leaves required")
	}
	lv := leavesVal.GetListValue()
	if lv == nil {
		return nil, errors.New("leaves must be list")
	}
	leaves := [][]byte{}
	for _, v := range lv.Values {
		leaf := v.GetStringValue()
		b, err := decodeData(leaf, enc)
		if err != nil {
			return nil, err
		}
		leaves = append(leaves, b)
	}
	proof, root, err := merkleProof(leaves, index, algo)
	if err != nil {
		return nil, err
	}
	steps := []*structpb.Value{}
	for _, p := range proof {
		steps = append(steps, structpb.NewStructValue(&structpb.Struct{Fields: map[string]*structpb.Value{
			"sibling": structpb.NewStringValue(p.Sibling),
			"left":    structpb.NewBoolValue(p.Left),
		}}))
	}
	return structpb.NewStruct(map[string]*structpb.Value{
		"proof": structpb.NewStructValue(&structpb.Struct{Fields: map[string]*structpb.Value{
			"steps": structpb.NewListValue(&structpb.ListValue{Values: steps}),
			"root":  structpb.NewStringValue(root),
		}}),
	}), nil
}

func verifyProof(proof []proofStep, leaf []byte, root string, algo string) (bool, error) {
	hash := hex.EncodeToString(leaf)
	cur, err := hex.DecodeString(hash)
	if err != nil {
		return false, err
	}
	for _, step := range proof {
		sib, err := hex.DecodeString(step.Sibling)
		if err != nil {
			return false, err
		}
		if step.Left {
			cur, err = merklePair(sib, cur, algo)
		} else {
			cur, err = merklePair(cur, sib, algo)
		}
		if err != nil {
			return false, err
		}
	}
	return strings.EqualFold(hex.EncodeToString(cur), root), nil
}

func (s *server) VerifyMerkleProof(ctx context.Context, in *structpb.Struct) (*structpb.Struct, error) {
	algo := decodeInput(in, "algorithm", "SHA-256")
	proofVal, ok := in.Fields["proof"]
	if !ok {
		return nil, errors.New("proof required")
	}
	pStruct := proofVal.GetStructValue()
	if pStruct == nil {
		return nil, errors.New("proof invalid")
	}
	root := pStruct.Fields["root"].GetStringValue()
	stepsList := pStruct.Fields["steps"].GetListValue()
	if stepsList == nil {
		return nil, errors.New("steps invalid")
	}
	leafRaw := decodeInput(in, "leaf", "")
	enc := decodeInput(in, "encoding", "utf8")
	leaf, err := decodeData(leafRaw, enc)
	if err != nil {
		return nil, err
	}
	steps := []proofStep{}
	for _, v := range stepsList.Values {
		s := v.GetStructValue()
		if s == nil {
			return nil, errors.New("step invalid")
		}
		steps = append(steps, proofStep{Sibling: s.Fields["sibling"].GetStringValue(), Left: s.Fields["left"].GetBoolValue()})
	}
	okRes, err := verifyProof(steps, leaf, root, algo)
	if err != nil {
		return nil, err
	}
	return structpb.NewStruct(map[string]*structpb.Value{"valid": structpb.NewBoolValue(okRes)}), nil
}

func (s *server) Ed25519Keygen(ctx context.Context, in *structpb.Struct) (*structpb.Struct, error) {
	pub, priv, err := ed25519.GenerateKey(crypto_rand.Reader)
	if err != nil {
		return nil, err
	}
	return structpb.NewStruct(map[string]*structpb.Value{
		"publicKey":  structpb.NewStringValue(hex.EncodeToString(pub)),
		"privateKey": structpb.NewStringValue(hex.EncodeToString(priv)),
	}), nil
}

func (s *server) Ed25519Sign(ctx context.Context, in *structpb.Struct) (*structpb.Struct, error) {
	msg := decodeInput(in, "message", "")
	enc := decodeInput(in, "encoding", "utf8")
	privHex := decodeInput(in, "privateKey", "")
	priv, err := hex.DecodeString(privHex)
	if err != nil {
		return nil, err
	}
	data, err := decodeData(msg, enc)
	if err != nil {
		return nil, err
	}
	sig := ed25519.Sign(priv, data)
	return structpb.NewStruct(map[string]*structpb.Value{"signature": structpb.NewStringValue(hex.EncodeToString(sig))}), nil
}

func (s *server) Ed25519Verify(ctx context.Context, in *structpb.Struct) (*structpb.Struct, error) {
	msg := decodeInput(in, "message", "")
	enc := decodeInput(in, "encoding", "utf8")
	pubHex := decodeInput(in, "publicKey", "")
	sigHex := decodeInput(in, "signature", "")
	pub, err := hex.DecodeString(pubHex)
	if err != nil {
		return nil, err
	}
	sig, err := hex.DecodeString(sigHex)
	if err != nil {
		return nil, err
	}
	data, err := decodeData(msg, enc)
	if err != nil {
		return nil, err
	}
	valid := ed25519.Verify(pub, data, sig)
	return structpb.NewStruct(map[string]*structpb.Value{"valid": structpb.NewBoolValue(valid)}), nil
}

func (s *server) RandomBytes(ctx context.Context, in *structpb.Struct) (*structpb.Struct, error) {
	length := decodeInt(in, "length", 32)
	buf := make([]byte, length)
	if _, err := crypto_rand.Read(buf); err != nil {
		return nil, err
	}
	return structpb.NewStruct(map[string]*structpb.Value{"bytes": structpb.NewStringValue(hex.EncodeToString(buf))}), nil
}

func (s *server) RandomInt(ctx context.Context, in *structpb.Struct) (*structpb.Struct, error) {
	max := decodeInput(in, "max", "0")
	m, ok := new(big.Int).SetString(max, 10)
	if !ok || m.Sign() <= 0 {
		return nil, errors.New("max must be >0")
	}
	n, err := crypto_rand.Int(crypto_rand.Reader, m)
	if err != nil {
		return nil, err
	}
	return structpb.NewStruct(map[string]*structpb.Value{"value": structpb.NewStringValue(n.String())}), nil
}

func (s *server) BLSKeygen(ctx context.Context, in *structpb.Struct) (*structpb.Struct, error) {
	pk, sk, err := bls12381.GenerateKey(crypto_rand.Reader)
	if err != nil {
		return nil, err
	}
	pkBytes, err := pk.MarshalBinary()
	if err != nil {
		return nil, err
	}
	skBytes, err := sk.MarshalBinary()
	if err != nil {
		return nil, err
	}
	return structpb.NewStruct(map[string]*structpb.Value{
		"publicKey":  structpb.NewStringValue(hex.EncodeToString(pkBytes)),
		"privateKey": structpb.NewStringValue(hex.EncodeToString(skBytes)),
	}), nil
}

func (s *server) BLSSign(ctx context.Context, in *structpb.Struct) (*structpb.Struct, error) {
	msg := decodeInput(in, "message", "")
	enc := decodeInput(in, "encoding", "utf8")
	privHex := decodeInput(in, "privateKey", "")
	data, err := decodeData(msg, enc)
	if err != nil {
		return nil, err
	}
	privBytes, err := hex.DecodeString(privHex)
	if err != nil {
		return nil, err
	}
	var sk bls12381.PrivateKey
	if err := sk.UnmarshalBinary(privBytes); err != nil {
		return nil, err
	}
	sig, err := bls12381.Sign(&sk, data)
	if err != nil {
		return nil, err
	}
	return structpb.NewStruct(map[string]*structpb.Value{"signature": structpb.NewStringValue(hex.EncodeToString(sig))}), nil
}

func (s *server) BLSVerify(ctx context.Context, in *structpb.Struct) (*structpb.Struct, error) {
	msg := decodeInput(in, "message", "")
	enc := decodeInput(in, "encoding", "utf8")
	pubHex := decodeInput(in, "publicKey", "")
	sigHex := decodeInput(in, "signature", "")
	data, err := decodeData(msg, enc)
	if err != nil {
		return nil, err
	}
	pubBytes, err := hex.DecodeString(pubHex)
	if err != nil {
		return nil, err
	}
	sigBytes, err := hex.DecodeString(sigHex)
	if err != nil {
		return nil, err
	}
	var pk bls12381.PublicKey
	if err := pk.UnmarshalBinary(pubBytes); err != nil {
		return nil, err
	}
	ok := bls12381.Verify(&pk, data, sigBytes)
	return structpb.NewStruct(map[string]*structpb.Value{"valid": structpb.NewBoolValue(ok)}), nil
}

func _hashHandler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(structpb.Struct)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(CryptoPrimitivesServer).Hash(ctx, in)
	}
	info := &grpc.UnaryServerInfo{Server: srv, FullMethod: "/cryptoprimitives.CryptoPrimitives/Hash"}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(CryptoPrimitivesServer).Hash(ctx, req.(*structpb.Struct))
	}
	return interceptor(ctx, in, info, handler)
}

func _verifyHashHandler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(structpb.Struct)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(CryptoPrimitivesServer).VerifyHash(ctx, in)
	}
	info := &grpc.UnaryServerInfo{Server: srv, FullMethod: "/cryptoprimitives.CryptoPrimitives/VerifyHash"}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(CryptoPrimitivesServer).VerifyHash(ctx, req.(*structpb.Struct))
	}
	return interceptor(ctx, in, info, handler)
}

func _merkleRootHandler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(structpb.Struct)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(CryptoPrimitivesServer).MerkleRoot(ctx, in)
	}
	info := &grpc.UnaryServerInfo{Server: srv, FullMethod: "/cryptoprimitives.CryptoPrimitives/MerkleRoot"}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(CryptoPrimitivesServer).MerkleRoot(ctx, req.(*structpb.Struct))
	}
	return interceptor(ctx, in, info, handler)
}

func _merkleProofHandler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(structpb.Struct)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(CryptoPrimitivesServer).MerkleProof(ctx, in)
	}
	info := &grpc.UnaryServerInfo{Server: srv, FullMethod: "/cryptoprimitives.CryptoPrimitives/MerkleProof"}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(CryptoPrimitivesServer).MerkleProof(ctx, req.(*structpb.Struct))
	}
	return interceptor(ctx, in, info, handler)
}

func _verifyMerkleProofHandler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(structpb.Struct)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(CryptoPrimitivesServer).VerifyMerkleProof(ctx, in)
	}
	info := &grpc.UnaryServerInfo{Server: srv, FullMethod: "/cryptoprimitives.CryptoPrimitives/VerifyMerkleProof"}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(CryptoPrimitivesServer).VerifyMerkleProof(ctx, req.(*structpb.Struct))
	}
	return interceptor(ctx, in, info, handler)
}

func _ed25519KeygenHandler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(structpb.Struct)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(CryptoPrimitivesServer).Ed25519Keygen(ctx, in)
	}
	info := &grpc.UnaryServerInfo{Server: srv, FullMethod: "/cryptoprimitives.CryptoPrimitives/Ed25519Keygen"}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(CryptoPrimitivesServer).Ed25519Keygen(ctx, req.(*structpb.Struct))
	}
	return interceptor(ctx, in, info, handler)
}

func _ed25519SignHandler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(structpb.Struct)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(CryptoPrimitivesServer).Ed25519Sign(ctx, in)
	}
	info := &grpc.UnaryServerInfo{Server: srv, FullMethod: "/cryptoprimitives.CryptoPrimitives/Ed25519Sign"}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(CryptoPrimitivesServer).Ed25519Sign(ctx, req.(*structpb.Struct))
	}
	return interceptor(ctx, in, info, handler)
}

func _ed25519VerifyHandler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(structpb.Struct)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(CryptoPrimitivesServer).Ed25519Verify(ctx, in)
	}
	info := &grpc.UnaryServerInfo{Server: srv, FullMethod: "/cryptoprimitives.CryptoPrimitives/Ed25519Verify"}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(CryptoPrimitivesServer).Ed25519Verify(ctx, req.(*structpb.Struct))
	}
	return interceptor(ctx, in, info, handler)
}

func _randomBytesHandler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(structpb.Struct)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(CryptoPrimitivesServer).RandomBytes(ctx, in)
	}
	info := &grpc.UnaryServerInfo{Server: srv, FullMethod: "/cryptoprimitives.CryptoPrimitives/RandomBytes"}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(CryptoPrimitivesServer).RandomBytes(ctx, req.(*structpb.Struct))
	}
	return interceptor(ctx, in, info, handler)
}

func _randomIntHandler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(structpb.Struct)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(CryptoPrimitivesServer).RandomInt(ctx, in)
	}
	info := &grpc.UnaryServerInfo{Server: srv, FullMethod: "/cryptoprimitives.CryptoPrimitives/RandomInt"}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(CryptoPrimitivesServer).RandomInt(ctx, req.(*structpb.Struct))
	}
	return interceptor(ctx, in, info, handler)
}

func _blsKeygenHandler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(structpb.Struct)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(CryptoPrimitivesServer).BLSKeygen(ctx, in)
	}
	info := &grpc.UnaryServerInfo{Server: srv, FullMethod: "/cryptoprimitives.CryptoPrimitives/BLSKeygen"}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(CryptoPrimitivesServer).BLSKeygen(ctx, req.(*structpb.Struct))
	}
	return interceptor(ctx, in, info, handler)
}

func _blsSignHandler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(structpb.Struct)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(CryptoPrimitivesServer).BLSSign(ctx, in)
	}
	info := &grpc.UnaryServerInfo{Server: srv, FullMethod: "/cryptoprimitives.CryptoPrimitives/BLSSign"}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(CryptoPrimitivesServer).BLSSign(ctx, req.(*structpb.Struct))
	}
	return interceptor(ctx, in, info, handler)
}

func _blsVerifyHandler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(structpb.Struct)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(CryptoPrimitivesServer).BLSVerify(ctx, in)
	}
	info := &grpc.UnaryServerInfo{Server: srv, FullMethod: "/cryptoprimitives.CryptoPrimitives/BLSVerify"}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(CryptoPrimitivesServer).BLSVerify(ctx, req.(*structpb.Struct))
	}
	return interceptor(ctx, in, info, handler)
}

var cryptoServiceDesc = grpc.ServiceDesc{
	ServiceName: "cryptoprimitives.CryptoPrimitives",
	HandlerType: (*CryptoPrimitivesServer)(nil),
	Methods: []grpc.MethodDesc{
		{Name: "Hash", Handler: _hashHandler},
		{Name: "VerifyHash", Handler: _verifyHashHandler},
		{Name: "MerkleRoot", Handler: _merkleRootHandler},
		{Name: "MerkleProof", Handler: _merkleProofHandler},
		{Name: "VerifyMerkleProof", Handler: _verifyMerkleProofHandler},
		{Name: "Ed25519Keygen", Handler: _ed25519KeygenHandler},
		{Name: "Ed25519Sign", Handler: _ed25519SignHandler},
		{Name: "Ed25519Verify", Handler: _ed25519VerifyHandler},
		{Name: "RandomBytes", Handler: _randomBytesHandler},
		{Name: "RandomInt", Handler: _randomIntHandler},
		{Name: "BLSKeygen", Handler: _blsKeygenHandler},
		{Name: "BLSSign", Handler: _blsSignHandler},
		{Name: "BLSVerify", Handler: _blsVerifyHandler},
	},
}

func main() {
	addr := ":50051"
	lis, err := net.Listen("tcp", addr)
	if err != nil {
		panic(err)
	}
	grpcServer := grpc.NewServer()
	s := &server{}
	grpcServer.RegisterService(&cryptoServiceDesc, s)
	if err := grpcServer.Serve(lis); err != nil {
		panic(err)
	}
}
