## Code convention and naming convention
First, don't worry too much about code conventions and best practices when writing code. All requests will be reviewed before merged.

File that has suffix `_test` is test file. For example `repo_test.go` is testing functions implemented in `repo.go`. Furthermore, test file can contains benchmark: how fast function is, how much memory it consumes, etc). 

Function that has suffix `Handle` (its signature look like this `func xxxHandle(w http.ResponseWriter, r *http.Request)`) will directly processing HTTP request.

In Go, the visibility of identifiers (like variables, constants, types, functions, and methods) is controlled by the first letter of their names (i.e., whehter that stuff is exported or unexported)