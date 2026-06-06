package server

import (
	"github.com/ariga/shekinah-backend/internal/admin"
	adminbranches "github.com/ariga/shekinah-backend/internal/admin/branches"
	admindevotions "github.com/ariga/shekinah-backend/internal/admin/devotions"
	adminevents "github.com/ariga/shekinah-backend/internal/admin/events"
	adminliveconfig "github.com/ariga/shekinah-backend/internal/admin/liveconfig"
	adminmedia "github.com/ariga/shekinah-backend/internal/admin/media"
	adminsermons "github.com/ariga/shekinah-backend/internal/admin/sermons"
	adminupdates "github.com/ariga/shekinah-backend/internal/admin/updates"
	"github.com/ariga/shekinah-backend/internal/auth"
	"github.com/ariga/shekinah-backend/internal/config"
	"github.com/ariga/shekinah-backend/internal/content"
	"github.com/ariga/shekinah-backend/internal/giving"
	"github.com/ariga/shekinah-backend/internal/health"
	"github.com/ariga/shekinah-backend/internal/httpx"
	"github.com/ariga/shekinah-backend/internal/notifications"
	"github.com/ariga/shekinah-backend/internal/prayers"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func New(cfg config.Config, db *pgxpool.Pool) *gin.Engine {
	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(httpx.CORS())

	r.Use(httpx.RequestID())
	r.Use(httpx.Logger())
	r.Use(httpx.Recoverer())
	r.Use(httpx.JSONHeaders())

	contentRepository := content.NewRepository(db)
	contentService := content.NewService(contentRepository)
	contentHandler := content.NewHandler(contentService)

	authRepository := auth.NewRepository(db)
	authService := auth.NewService(authRepository, cfg.JWTSecret)
	authHandler := auth.NewHandler(authService)

	adminDevotionRepository := admindevotions.NewRepository(db)
	adminDevotionService := admindevotions.NewService(adminDevotionRepository)
	adminDevotionHandler := admindevotions.NewHandler(adminDevotionService)
	adminHandler := admin.NewHandler()
	adminSermonRepository := adminsermons.NewRepository(db)
	adminSermonService := adminsermons.NewService(adminSermonRepository)
	adminSermonHandler := adminsermons.NewHandler(adminSermonService)

	adminEventRepository := adminevents.NewRepository(db)
	adminEventService := adminevents.NewService(adminEventRepository)
	adminEventHandler := adminevents.NewHandler(adminEventService)

	adminUpdateRepository := adminupdates.NewRepository(db)
	adminUpdateService := adminupdates.NewService(adminUpdateRepository)
	adminUpdateHandler := adminupdates.NewHandler(adminUpdateService)

	adminBranchRepository := adminbranches.NewRepository(db)
	adminBranchService := adminbranches.NewService(adminBranchRepository)
	adminBranchHandler := adminbranches.NewHandler(adminBranchService)

	adminLiveConfigRepository := adminliveconfig.NewRepository(db)
	adminLiveConfigService := adminliveconfig.NewService(adminLiveConfigRepository)
	adminLiveConfigHandler := adminliveconfig.NewHandler(adminLiveConfigService)
	adminMediaHandler := adminmedia.NewHandler()
	givingHandler := giving.NewHandler(db)
	notificationHandler := notifications.NewHandler(db)
	prayerHandler := prayers.NewHandler(db)

	r.GET("/healthz", health.HandleHealthz(cfg, db))
	r.Static("/uploads", "./uploads")

	api := r.Group("/api/v1")
	{
		api.GET("/healthz", health.HandleHealthz(cfg, db))
		api.GET("/home", contentHandler.Home)
		api.POST("/giving/mpesa/stk-push", givingHandler.STKPush)
		api.POST("/giving/mpesa/callback", givingHandler.Callback)
		api.GET("/giving/transactions/:id", givingHandler.GetTransaction)
		api.POST("/notifications/register", notificationHandler.RegisterDevice)
		api.PATCH("/notifications/preferences", notificationHandler.UpdatePreferences)
		api.POST("/prayer-requests", prayerHandler.Create)

		authGroup := api.Group("/auth")
		{
			authGroup.POST("/register", authHandler.Register)
			authGroup.POST("/login", authHandler.Login)
			authGroup.GET("/me", auth.RequireAuth(authService), authHandler.Me)
		}

		adminGroup := api.Group("/admin")
		adminGroup.Use(auth.RequireRole(authService, "admin", "super_admin"))
		{
			adminGroup.GET("/healthz", adminHandler.Healthz)

			adminGroup.GET("/sermons", adminSermonHandler.List)
			adminGroup.POST("/sermons", adminSermonHandler.Create)
			adminGroup.PATCH("/sermons/:id", adminSermonHandler.Update)
			adminGroup.DELETE("/sermons/:id", adminSermonHandler.Delete)

			adminGroup.GET("/devotions", adminDevotionHandler.List)
			adminGroup.POST("/devotions", adminDevotionHandler.Create)
			adminGroup.PATCH("/devotions/:id", adminDevotionHandler.Update)
			adminGroup.DELETE("/devotions/:id", adminDevotionHandler.Delete)

			adminGroup.GET("/events", adminEventHandler.List)
			adminGroup.POST("/events", adminEventHandler.Create)
			adminGroup.PATCH("/events/:id", adminEventHandler.Update)
			adminGroup.DELETE("/events/:id", adminEventHandler.Delete)

			adminGroup.GET("/updates", adminUpdateHandler.List)
			adminGroup.POST("/updates", adminUpdateHandler.Create)
			adminGroup.PATCH("/updates/:id", adminUpdateHandler.Update)
			adminGroup.DELETE("/updates/:id", adminUpdateHandler.Delete)

			adminGroup.GET("/branches", adminBranchHandler.List)
			adminGroup.POST("/branches", adminBranchHandler.Create)
			adminGroup.PATCH("/branches/:id", adminBranchHandler.Update)
			adminGroup.DELETE("/branches/:id", adminBranchHandler.Delete)

			adminGroup.GET("/live-config", adminLiveConfigHandler.Get)
			adminGroup.PATCH("/live-config", adminLiveConfigHandler.Update)
			adminGroup.POST("/media", adminMediaHandler.Upload)
			adminGroup.GET("/giving/transactions", givingHandler.ListTransactions)
			adminGroup.GET("/notifications/messages", notificationHandler.ListMessages)
			adminGroup.POST("/notifications/broadcast", notificationHandler.Broadcast)
		}
	}

	return r
}
