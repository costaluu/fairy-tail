package main

import (
	"bufio"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"strconv"
)

type Broker struct {

	// Events are pushed to this channel by the main events-gathering routine
	Notifier chan []byte

	// New client connections
	newClients chan chan []byte

	// Closed client connections
	closingClients chan chan []byte

	// Client connections registry
	clients map[chan []byte]bool
}

func NewServer() (broker *Broker) {
	// Instantiate a broker
	broker = &Broker{
		Notifier:       make(chan []byte, 1),
		newClients:     make(chan chan []byte),
		closingClients: make(chan chan []byte),
		clients:        make(map[chan []byte]bool),
	}

	// Set it running - listening and broadcasting events
	go broker.listen()

	return
}

func (broker *Broker) ServeHTTP(rw http.ResponseWriter, req *http.Request) {
	// Make sure that the writer supports flushing.
	//
	flusher, ok := rw.(http.Flusher)

	if !ok {
		http.Error(rw, "Streaming unsupported!", http.StatusInternalServerError)
		return
	}

	rw.Header().Set("Content-Type", "text/event-stream")
	rw.Header().Set("Cache-Control", "no-cache")
	rw.Header().Set("Connection", "keep-alive")
	rw.Header().Set("Access-Control-Allow-Origin", "*")

	// Each connection registers its own message channel with the Broker's connections registry
	messageChan := make(chan []byte)

	// Signal the broker that we have a new connection
	broker.newClients <- messageChan

	// Remove this client from the map of connected clients
	// when this handler exits.
	defer func() {
		broker.closingClients <- messageChan
	}()

	// Listen to connection close and un-register messageChan
	// notify := rw.(http.CloseNotifier).CloseNotify()
	notify := req.Context().Done()

	go func() {
		<-notify
		broker.closingClients <- messageChan
	}()

	for {

		// Write to the ResponseWriter
		// Server Sent Events compatible
		fmt.Fprintf(rw, "data: %s\n\n", <-messageChan)

		// Flush the data immediatly instead of buffering it for later.
		flusher.Flush()
	}
}

func (broker *Broker) listen() {
	for {
		select {
		case s := <-broker.newClients:

			// A new client has connected.
			// Register their message channel
			broker.clients[s] = true
			log.Printf("Client added. %d registered clients", len(broker.clients))
		case s := <-broker.closingClients:

			// A client has dettached and we want to
			// stop sending them messages.
			delete(broker.clients, s)
			log.Printf("Removed client. %d registered clients", len(broker.clients))
		case event := <-broker.Notifier:

			// We got a new event from the outside!
			// Send event to all connected clients
			for clientMessageChan, _ := range broker.clients {
				clientMessageChan <- event
			}
		}
	}
}

func app(path string, port int) {
	broker := NewServer()

	go func() {
		for {
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

			fmt.Println("Stream created!")

			for scanner.Scan() {
				broker.Notifier <- []byte(scanner.Text())
			}
		}
	}()

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

	log.Fatal("HTTP server error: ", http.ListenAndServe(fmt.Sprintf(":%d", port), broker))
}

func checkFileExists(filePath string) bool {
	_, error := os.Stat(filePath)

	return !errors.Is(error, os.ErrNotExist)
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
