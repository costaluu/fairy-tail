package main

import (
	"bufio"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"time"
)

func checkFileExists(filePath string) bool {
	_, error := os.Stat(filePath)

	return !errors.Is(error, os.ErrNotExist)
}

func app(path string, port int) {
	newConnection := false;
    messages := make(chan string, 100)

	fmt.Println("Tailing...")

    cmd := exec.Command("tail", "-f", path)

    stdout, err := cmd.StdoutPipe()

    if err != nil {
        fmt.Println(err);
        panic(err)
    }

    err = cmd.Start()

    if err != nil {
        panic(err)
    }

    scanner := bufio.NewScanner(stdout)

	fmt.Println("Creating stream...")

    go func() {
        for scanner.Scan() {
            messages <- scanner.Text()
        }
    }()

    http.HandleFunc("/sse", func(w http.ResponseWriter, r *http.Request) {
		done := false

		go func() {
			<-r.Context().Done()
			done = true
		}()

        w.Header().Set("Content-Type", "text/event-stream")
        w.Header().Set("Cache-Control", "no-cache")
        w.Header().Set("Connection", "keep-alive")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		newConnection = true;
		
		time.AfterFunc(5 * time.Second, func () {
			newConnection = false;
		})

        for m := range messages {
			fmt.Fprintf(w, "event: message\n")

			if newConnection {
				fmt.Fprintf(w, "data: !FORCE_SHUTDOWN!\n\n")
			} else {
            	fmt.Fprintf(w, "data: %s\n\n", m)
			}

			w.(http.Flusher).Flush()

			if done {
				r.Body.Close()
				return;
			}
        }
    })

    http.HandleFunc("/html/styles.css", func(w http.ResponseWriter, r *http.Request) {
        http.ServeFile(w, r, "./html/styles.css")
    })

    http.HandleFunc("/html/app.js", func(w http.ResponseWriter, r *http.Request) {
        http.ServeFile(w, r, "./html/app.js")
    })

    http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        http.ServeFile(w, r, "./html/index.html")
    })

	fmt.Println("Stream created! Server on!")

    go http.ListenAndServe(fmt.Sprintf(":%d", port), nil)

    err = cmd.Wait()

    if err != nil {
        panic(err)
    }    
}

func main() {
    argsWithoutProg := os.Args[1:]

	if len(argsWithoutProg) == 0 {
		fmt.Println("No arugments provided, use the 'help' command")
	} else if argsWithoutProg[0] == "help" {
		fmt.Println("Tails help")
		fmt.Println("before running the serve command make sure that the html folder is in the same folder of this executable")
		fmt.Println("only 1 connection to the server is allowed")
		fmt.Println("the serve command is: server ./path/to/file/to/tail port both parameters are mandatory")
	} else if argsWithoutProg[0] == "commands" {
		fmt.Println("Tails commands")
		fmt.Println("help: runs the help command.")
		fmt.Println("commands: shows all commands.")
		fmt.Println("about: tell more about tails.")
		fmt.Println("serve ./path/to/file/to/tail port: serves a file in to the web")
	} else if argsWithoutProg[0] == "serve" {
		if len(argsWithoutProg) <= 2 {
			fmt.Println("Invalid arguments for the serve command. use the help command")
		} else if argsWithoutProg[1] == "" {
			fmt.Println("Please provide a path to the file");
		} else if !checkFileExists(argsWithoutProg[1]) {
			fmt.Printf(`"%s" path not found`, argsWithoutProg[1]);
		} else if argsWithoutProg[2] == "" {
			fmt.Println("Please provide a port to serve the app")
		} else if !regexp.MustCompile(`\d`).MatchString(argsWithoutProg[2]) {
			fmt.Println("Please provide a valid port");
		} else {
			port, err := strconv.Atoi(argsWithoutProg[2])

			if err != nil {
				fmt.Println("Please provide a valid port")
				return
			}

			fmt.Println("Running the server...")

			app(argsWithoutProg[1], port)
		}
	} else if argsWithoutProg[0] == "about" {
		fmt.Println("Tails about")
		fmt.Println("Tails is application that aims into serving a tail log to the web with no time")
		fmt.Println("the connection is based on SSE (Server-Sent-Events) tails do not use websockets to make the connection.")
	} else {
		fmt.Println("Command not found try to use the help command")
	}
}
