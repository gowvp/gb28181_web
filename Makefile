.phony: build/cli
build/cli:
	@yarn build
	@rm -rf ../gb28181/www && mv build/client ../gb28181/www
