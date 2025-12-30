package main

import (
	context "context"
	testing "testing"

	"google.golang.org/protobuf/types/known/structpb"
)

func TestBLSRoundTrip(t *testing.T) {
	s := &server{}
	ctx := context.Background()

	keys, err := s.BLSKeygen(ctx, &structpb.Struct{Fields: map[string]*structpb.Value{}})
	if err != nil {
		t.Fatalf("keygen error: %v", err)
	}
	pk := keys.Fields["publicKey"].GetStringValue()
	sk := keys.Fields["privateKey"].GetStringValue()

	sigRes, err := s.BLSSign(ctx, &structpb.Struct{Fields: map[string]*structpb.Value{
		"message":    structpb.NewStringValue("hello"),
		"encoding":   structpb.NewStringValue("utf8"),
		"privateKey": structpb.NewStringValue(sk),
	}})
	if err != nil {
		t.Fatalf("sign error: %v", err)
	}
	sig := sigRes.Fields["signature"].GetStringValue()

	verifyRes, err := s.BLSVerify(ctx, &structpb.Struct{Fields: map[string]*structpb.Value{
		"message":   structpb.NewStringValue("hello"),
		"encoding":  structpb.NewStringValue("utf8"),
		"publicKey": structpb.NewStringValue(pk),
		"signature": structpb.NewStringValue(sig),
	}})
	if err != nil {
		t.Fatalf("verify error: %v", err)
	}
	if !verifyRes.Fields["valid"].GetBoolValue() {
		t.Fatalf("expected valid signature")
	}

	// Negative case
	badVerify, err := s.BLSVerify(ctx, &structpb.Struct{Fields: map[string]*structpb.Value{
		"message":   structpb.NewStringValue("hello!"),
		"encoding":  structpb.NewStringValue("utf8"),
		"publicKey": structpb.NewStringValue(pk),
		"signature": structpb.NewStringValue(sig),
	}})
	if err != nil {
		t.Fatalf("verify error (bad): %v", err)
	}
	if badVerify.Fields["valid"].GetBoolValue() {
		t.Fatalf("expected invalid signature for tampered message")
	}
}
