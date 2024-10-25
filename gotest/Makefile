all: mac winx64 winarm64

mac:
	go build -ldflags "-w -s" -o test-macos
	7z a test-macos.7z test-macos
winx64:
	GOOS=windows GOARCH=amd64 go build -ldflags "-w -s" -o test-winx64
	7z a test-winx64.7z test-winx64
winarm64:
	GOOS=windows GOARCH=arm64 go build -ldflags "-w -s" -o test-winarm64
	7z a test-winarm64.7z test-winarm64
clean:
	rm -f test-macos test-winx64 test-winarm64 test-macos.7z test-winx64.7z test-winarm64.7z
