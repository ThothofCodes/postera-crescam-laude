# ═══════════════════════════════════════════════════════════════════
# Postera Crescam Laude — Native Development Commands
# ═══════════════════════════════════════════════════════════════════

.PHONY: setup dev stop status clean seed install help

NODE ?= node
NPM ?= npm
BACKEND_DIR := backend
FRONTEND_DIR := frontend
BACKEND_PORT ?= 5001
FRONTEND_PORT ?= 3000

# ── First-Time Setup ──────────────────────────────────────────────
setup:
	@echo "🔍 Installing dependencies..."
	cd $(BACKEND_DIR) && $(NPM) install --legacy-peer-deps
	cd $(FRONTEND_DIR) && $(NPM) install --legacy-peer-deps
	@# Generate JWT_SECRET if placeholder
	@grep -q '^JWT_SECRET=CHANGE_ME' $(BACKEND_DIR)/.env 2>/dev/null && \
		JWT=$$(openssl rand -base64 48 | tr -d '\n') && \
		sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$$JWT|" $(BACKEND_DIR)/.env && \
		echo "🔑 Generated JWT_SECRET" || \
		echo "✅ JWT_SECRET already set"
	@# Generate CSRF_SECRET if placeholder
	@grep -q '^CSRF_SECRET=CHANGE_ME' $(BACKEND_DIR)/.env 2>/dev/null && \
		CSRF=$$(openssl rand -base64 48 | tr -d '\n') && \
		sed -i "s|^CSRF_SECRET=.*|CSRF_SECRET=$$CSRF|" $(BACKEND_DIR)/.env && \
		echo "🔑 Generated CSRF_SECRET" || \
		echo "✅ CSRF_SECRET already set"
	@echo ""
	@echo "✅ Setup complete. Run: make dev"

# ── Start Backend + Frontend ─────────────────────────────────────
dev:
	@echo "🚀 Starting PCL (Backend: :$(BACKEND_PORT), Frontend: :$(FRONTEND_PORT))"
	@echo "   Backend:  http://localhost:$(BACKEND_PORT)/api/health"
	@echo "   Frontend: http://localhost:$(FRONTEND_PORT)"
	@echo "   Swagger:  http://localhost:$(BACKEND_PORT)/api/docs"
	@echo ""
	cd $(BACKEND_DIR) && PORT=$(BACKEND_PORT) $(NPM) run dev &
	cd $(FRONTEND_DIR) && npx vite --port $(FRONTEND_PORT) --host 0.0.0.0 &

# ── Start Backend Only ───────────────────────────────────────────
backend:
	cd $(BACKEND_DIR) && PORT=$(BACKEND_PORT) $(NPM) run dev

# ── Start Frontend Only ──────────────────────────────────────────
frontend:
	cd $(FRONTEND_DIR) && npx vite --port $(FRONTEND_PORT) --host 0.0.0.0

# ── Stop All ─────────────────────────────────────────────────────
stop:
	@echo "Stopping Node processes..."
	@pkill -f "node server.js" 2>/dev/null && echo "✅ Backend stopped" || echo "⚠️  Backend not running"
	@pkill -f "vite" 2>/dev/null && echo "✅ Frontend stopped" || echo "⚠️  Frontend not running"

# ── Status Check ──────────────────────────────────────────────────
status:
	@echo "=== Services ==="
	@curl -sf http://localhost:$(BACKEND_PORT)/api/health 2>/dev/null && echo " ✅ Backend" || echo " ❌ Backend"
	@curl -sf http://localhost:$(FRONTEND_PORT) > /dev/null 2>&1 && echo " ✅ Frontend" || echo " ❌ Frontend"
	@echo ""
	@echo "=== Infrastructure ==="
	@mongosh --eval "db.runCommand({ping:1})" --port 27017 --quiet 2>/dev/null && echo "✅ MongoDB" || echo "❌ MongoDB"
	@redis-cli ping 2>/dev/null | grep -q PONG && echo "✅ Redis" || echo "❌ Redis"
	@curl -sf http://localhost:9000/minio/health/live > /dev/null 2>&1 && echo "✅ MinIO" || echo "❌ MinIO"
	@curl -sf http://localhost:7880 > /dev/null 2>&1 && echo "✅ LiveKit" || echo "❌ LiveKit"

# ── Build for Production ──────────────────────────────────────────
build:
	cd $(FRONTEND_DIR) && $(NPM) run build
	@echo "✅ Frontend built to $(FRONTEND_DIR)/dist"

# ── Seed Database ─────────────────────────────────────────────────
seed:
	cd $(BACKEND_DIR) && node seed.js

# ── Run Tests ─────────────────────────────────────────────────────
test:
	cd $(BACKEND_DIR) && $(NPM) test

smoke:
	bash $(BACKEND_DIR)/test/smoke-test.sh

# ── Clean Logs ────────────────────────────────────────────────────
clean-logs:
	@rm -f /tmp/pcl-*.log
	@echo "✅ Logs cleaned"

# ── Help ──────────────────────────────────────────────────────────
help:
	@echo "PCL Native Development Commands"
	@echo "================================"
	@echo "  make setup       Install deps + generate secrets"
	@echo "  make dev         Start backend + frontend"
	@echo "  make backend     Start backend only"
	@echo "  make frontend    Start frontend only"
	@echo "  make stop        Stop all Node processes"
	@echo "  make status      Check all services"
	@echo "  make build       Build frontend for production"
	@echo "  make seed        Seed database"
	@echo "  make test        Run backend tests"
	@echo "  make smoke       Run smoke test against running server"
	@echo "  make clean-logs  Remove temp log files"
	@echo "  make help        Show this help"
	@echo ""
	@echo "Infrastructure (run natively):"
	@echo "  MongoDB:   localhost:27017"
	@echo "  Redis:     localhost:6379"
	@echo "  MinIO:     localhost:9000 (API) / :9001 (Console)"
	@echo "  LiveKit:   localhost:7880"
