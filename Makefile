.phony: build/cli
build/cli:
	@yarn build
	@rm -rf ../gb28181/www && mv dist ../gb28181/www
