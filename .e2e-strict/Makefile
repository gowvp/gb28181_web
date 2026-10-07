PROJECT_ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST)))/..)
NODE ?= node
export PLAYWRIGHT_BROWSERS_PATH ?= $(PROJECT_ROOT)/node_modules/.cache/ms-playwright

.DEFAULT_GOAL := help
.PHONY: help install run headed ui report

help:
	@echo "make run     自动启动并执行严格 E2E"
	@echo "make headed  显示浏览器并执行相同测试"
	@echo "make ui      打开网页测试面板 http://127.0.0.1:9323"
	@echo "make report  打开最近一次测试报告"
	@echo "make install 安装完整测试浏览器"

install:
	@cd "$(PROJECT_ROOT)" && "$(NODE)" node_modules/@playwright/test/cli.js install chromium

run:
	@cd "$(PROJECT_ROOT)" && "$(NODE)" node_modules/@playwright/test/cli.js install chromium --only-shell
	@cd "$(PROJECT_ROOT)" && "$(NODE)" .e2e-strict/run.mjs

headed: install
	@cd "$(PROJECT_ROOT)" && E2E_STRICT_HEADED=1 "$(NODE)" .e2e-strict/run.mjs

ui:
	@cd "$(PROJECT_ROOT)" && "$(NODE)" node_modules/@playwright/test/cli.js install chromium --only-shell
	@cd "$(PROJECT_ROOT)" && "$(NODE)" node_modules/@playwright/test/cli.js test -c .e2e-strict/playwright.config.mjs --ui-host=127.0.0.1 --ui-port=9323

report:
	@cd "$(PROJECT_ROOT)" && "$(NODE)" .e2e-strict/report.mjs
