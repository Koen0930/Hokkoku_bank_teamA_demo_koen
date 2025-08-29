# Docker Compose helper Makefile

COMPOSE := docker compose
SERVICE ?= backend

.PHONY: help up rebuild down stop restart build ps logs logs-backend logs-frontend logs-linebot clean reset

help:
	@echo "Available targets:"
	@echo "  up         - Start all services in detached mode"
	@echo "  rebuild    - Build images and start services (same as up --build)"
	@echo "  down       - Stop and remove containers"
	@echo "  stop       - Stop running containers"
	@echo "  restart    - Restart all services"
	@echo "  build      - Build images"
	@echo "  ps         - Show container status"
	@echo "  logs       - Follow logs (SERVICE=<name>, default: backend)"
	@echo "  logs-backend  - Follow backend logs"
	@echo "  logs-frontend - Follow frontend logs"
	@echo "  logs-linebot  - Follow linebot logs"
	@echo "  clean      - Remove stopped containers and dangling images (safe)"
	@echo "  reset      - Compose down with volumes (CAUTION)"

up:
	$(COMPOSE) up -d

rebuild:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

stop:
	$(COMPOSE) stop

restart:
	$(COMPOSE) restart

build:
	$(COMPOSE) build

ps:
	$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f $(SERVICE)

logs-backend:
	$(COMPOSE) logs -f backend

logs-frontend:
	$(COMPOSE) logs -f frontend

logs-linebot:
	$(COMPOSE) logs -f linebot

clean:
	docker system prune -f

reset:
	$(COMPOSE) down -v


