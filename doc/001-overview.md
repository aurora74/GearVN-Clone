## Overview
Entry point is `main.go`. From this file you can explore component of application.

To run the application:
```bash
go run .
```

### Flow of a request
![overview](/doc/image/overview.png)
When client sends a request, it first go to `muxer`. `muxer` will decide what `handler` responsible for dealing with this request (base on *pattern matching* technique). For example: request "POST /create" will create shorten url, handler for this request is `CreateShortURLHandle` (you can have a quick glance at `internal/url.go` for implementing of this handler). 

Handler will interact with repository (which manages storing and querying data from database).

### What file contain what ?
`/internal`: Private application and library code. This is the code you don't want others importing in their applications or libraries. 

`/internal/repo.go`: This file contains **repository** code (which deal with storing and querying data from database)

`/internal/shorten.go`: This file implementing **encode/decode** strategy for URL.

`/internal/url.go`: encapsulates the core logic for creating, retrieving, and managing shortened URLs in a web service context. All handler for each type of request is implementing here.

`/internal/http.go`: contains related things need to deal with when implementing request handler 

