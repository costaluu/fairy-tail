# Fairy Tail

A simple way to stream a tail command into the web.

# Get started

1. Download the zip file from github
2. Extract the zip
3. Run the command `fairy-tail serve /path/to/tail/file port`
4. Go to `localhost:port`

# About

Fairy tail uses SSE (Server Sent Events) to stream all the data for the clients. You can serve as many files you want.

# Source Code

Fairy tail server is built on Golang and the client is built on React, the client can render up to 40k lines of lines.

## License

[![Licence](https://img.shields.io/github/license/Ileriayo/markdown-badges?style=for-the-badge)](./LICENSE)
