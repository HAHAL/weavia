package vision

import "testing"

func TestParseStructure(t *testing.T) {
	reply := "好的：```json\n{\"hook\":\"痛点提问\",\"rhythm\":\"快\",\"music\":\"轻快\",\"shots\":[{\"duration\":3,\"visual\":\"手拿产品\"},{\"duration\":0,\"visual\":\"特写\"}]}\n```"
	got, err := ParseStructure(reply, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Shots) != 2 || got.Shots[1].Duration != 5 || got.Shots[1].Start != 3 {
		t.Fatalf("unexpected shots: %+v", got.Shots)
	}
	if _, err := ParseStructure("no json", 10); err == nil {
		t.Fatal("expected parse error")
	}
}
