package live

import (
	"context"
	"testing"
)

func TestMembersOnlyAccess(t *testing.T) {
	h := &Handler{}
	ctx := context.Background()
	open := &Session{}
	members := &Session{MembersOnly: true}
	if !h.canWatch(ctx, open, "") || !h.canWatch(ctx, open, "user-1") {
		t.Fatal("a free service is open to everyone")
	}
	if h.canWatch(ctx, members, "") {
		t.Fatal("a members-only service must refuse people who are signed out")
	}
	if !h.canWatch(ctx, members, "user-1") {
		t.Fatal("signed-in members may watch a members-only service")
	}
	t.Setenv("LIVE_INTERNAL_SECRET", "0123456789abcdef0123")
	if !internalRequest("internal=0123456789abcdef0123") || internalRequest("internal=wrong") || internalRequest("") {
		t.Fatal("internal secret check")
	}
	t.Setenv("LIVE_INTERNAL_SECRET", "short")
	if internalRequest("internal=short") {
		t.Fatal("a short secret must never be accepted")
	}
}
