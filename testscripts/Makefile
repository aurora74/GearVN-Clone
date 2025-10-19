URL := http://localhost/short
CONCURRENCY := 2000
REQUESTS := 10000
OUTPUT := results.txt 
JSON_DATA := data.json

.PHONY: write_test
write_test:
	@echo "Running write test on $(URL) with $(CONCURRENCY) concurrent users and $(REQUESTS) total requests..."
	ab -n $(REQUESTS) -c $(CONCURRENCY) -p $(JSON_DATA) -T 'application/json' $(URL) | tee $(OUTPUT)

.PHONY: clean
clean:
	@echo "Cleaning up result file..."
	rm -f $(OUTPUT)

# Help target to display usage
.PHONY: help
help:
	@echo "Apache Benchmark POST Load Testing Makefile"
	@echo "Usage:"
	@echo "  make test         Run the load test with specified settings"
	@echo "  make clean        Clean up the result file"
	@echo "  make help         Show this help message"
	@echo
	@echo "Variables:"
	@echo "  URL=$(URL)"
	@echo "  CONCURRENCY=$(CONCURRENCY)"
	@echo "  REQUESTS=$(REQUESTS)"
	@echo "  OUTPUT=$(OUTPUT)"
	@echo "  JSON_DATA=$(JSON_DATA)"

# Example usage: make write_test URL=http://localhost/short CONCURRENCY=20 REQUESTS=500 JSON_DATA=new_data.json
