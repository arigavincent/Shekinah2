package server

import (
	"github.com/ariga/shekinah-backend/internal/admin"
	adminbranches "github.com/ariga/shekinah-backend/internal/admin/branches"
	admindevotions "github.com/ariga/shekinah-backend/internal/admin/devotions"
	adminevents "github.com/ariga/shekinah-backend/internal/admin/events"
	adminlibrary "github.com/ariga/shekinah-backend/internal/admin/library"
	adminliveconfig "github.com/ariga/shekinah-backend/internal/admin/liveconfig"
	adminmedia "github.com/ariga/shekinah-backend/internal/admin/media"
	adminprayers "github.com/ariga/shekinah-backend/internal/admin/prayers"
	adminreadingplans "github.com/ariga/shekinah-backend/internal/admin/readingplans"
	adminsermons "github.com/ariga/shekinah-backend/internal/admin/sermons"
	adminupdates "github.com/ariga/shekinah-backend/internal/admin/updates"
	"github.com/ariga/shekinah-backend/internal/apibible"
	"github.com/ariga/shekinah-backend/internal/auth"
	"github.com/ariga/shekinah-backend/internal/bibleversions"
	"github.com/ariga/shekinah-backend/internal/checkins"
	"github.com/ariga/shekinah-backend/internal/community"
	"github.com/ariga/shekinah-backend/internal/config"
	"github.com/ariga/shekinah-backend/internal/content"
	"github.com/ariga/shekinah-backend/internal/giving"
	"github.com/ariga/shekinah-backend/internal/health"
	"github.com/ariga/shekinah-backend/internal/httpx"
	"github.com/ariga/shekinah-backend/internal/library"
	"github.com/ariga/shekinah-backend/internal/notifications"
	"github.com/ariga/shekinah-backend/internal/prayers"
	"github.com/ariga/shekinah-backend/internal/privatechat"
	"github.com/ariga/shekinah-backend/internal/readingplans"
	"github.com/ariga/shekinah-backend/internal/serve"
	"github.com/ariga/shekinah-backend/internal/settings"
	"github.com/ariga/shekinah-backend/internal/testimonies"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func New(cfg config.Config, db *pgxpool.Pool) *gin.Engine {
	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(httpx.CORS(cfg.AllowedOrigins))

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
	adminLiveConfigService := adminliveconfig.NewService(adminLiveConfigRepository, cfg)
	adminLiveConfigHandler := adminliveconfig.NewHandler(adminLiveConfigService)
	adminPrayerRepository := adminprayers.NewRepository(db)
	adminPrayerService := adminprayers.NewService(adminPrayerRepository)
	adminPrayerHandler := adminprayers.NewHandler(adminPrayerService)
	adminLibraryHandler := adminlibrary.NewHandler(db)
	adminReadingPlanHandler := adminreadingplans.NewHandler(db)
	adminMediaHandler := adminmedia.NewHandler()
	givingHandler := giving.NewHandler(db)
	notificationHandler := notifications.NewHandler(db)
	prayerHandler := prayers.NewHandler(db)
	communityHandler := community.NewHandler(db)
	testimonyHandler := testimonies.NewHandler(db)
	readingPlanHandler := readingplans.NewHandler(db)
	checkinHandler := checkins.NewHandler(db)
	bibleVersionsHandler := bibleversions.NewHandler(db, cfg)
	apiBibleHandler := apibible.NewHandler(cfg)
	privateChatHandler := privatechat.NewHandler(db)
	libraryHandler := library.NewHandler(db)
	settingsHandler := settings.NewHandler(db)
	serveHandler := serve.NewHandler()

	r.GET("/healthz", health.HandleHealthz(cfg, db))
	r.Static("/uploads", "./uploads")

	api := r.Group("/api/v1")
	{
		api.GET("/healthz", health.HandleHealthz(cfg, db))
		api.GET("/home", contentHandler.Home)
		api.POST("/giving/mpesa/stk-push", givingHandler.STKPush)
		api.POST("/giving/mpesa/callback", givingHandler.Callback)
		api.POST("/giving/card/checkout", givingHandler.CardCheckout)
		api.GET("/giving/card/return", givingHandler.CardReturn)
		api.GET("/giving/card/mock-checkout/:id", givingHandler.MockCheckoutPage)
		api.GET("/giving/card/mock-complete/:id", givingHandler.MockComplete)
		api.GET("/giving/transactions/:id", givingHandler.GetTransaction)
		api.GET("/giving/transactions/:id/receipt.pdf", givingHandler.DownloadReceipt)
		api.GET("/giving/transactions/:id/invoice.pdf", givingHandler.DownloadInvoice)
		api.POST("/notifications/register", notificationHandler.RegisterDevice)
		api.PATCH("/notifications/preferences", notificationHandler.UpdatePreferences)
		api.GET("/prayer-requests", prayerHandler.ListPublic)
		api.POST("/prayer-requests", auth.RequireAuth(authService), prayerHandler.Create)
		api.GET("/prayer-requests/mine", auth.RequireAuth(authService), prayerHandler.ListMine)
		api.POST("/prayer-requests/:id/pray", auth.RequireAuth(authService), prayerHandler.Pray)
		api.GET("/community/messages", communityHandler.List)
		api.GET("/community/live/stream", communityHandler.LiveStream)
		api.POST("/community/messages", auth.RequireAuth(authService), communityHandler.Create)
		api.GET("/testimonies", testimonyHandler.List)
		api.GET("/testimonies/mine", auth.RequireAuth(authService), testimonyHandler.ListMine)
		api.POST("/testimonies", auth.RequireAuth(authService), testimonyHandler.Create)
		api.POST("/testimonies/:id/like", auth.RequireAuth(authService), testimonyHandler.Like)
		api.GET("/reading-plans", readingPlanHandler.List)
		api.GET("/reading-plans/mine", auth.RequireAuth(authService), readingPlanHandler.List)
		api.GET("/reading-plans/:id", readingPlanHandler.Detail)
		api.GET("/reading-plans/:id/mine", auth.RequireAuth(authService), readingPlanHandler.Detail)
		api.POST("/reading-plans/:id/days/:day/complete", auth.RequireAuth(authService), readingPlanHandler.CompleteDay)
		api.PUT("/reading-plans/:id/days/:day/note", auth.RequireAuth(authService), readingPlanHandler.SaveNote)
		api.PATCH("/reading-plans/:id/reminder", auth.RequireAuth(authService), readingPlanHandler.UpdateReminder)
		api.GET("/checkin/code", auth.RequireAuth(authService), checkinHandler.MemberCode)
		api.GET("/checkin/history", auth.RequireAuth(authService), checkinHandler.Mine)
		api.GET("/library", libraryHandler.List)
		api.GET("/library/:id", libraryHandler.Detail)
		api.GET("/settings/serve", settingsHandler.GetServe)
		api.POST("/serve/request-pdf", serveHandler.UploadRequestPDF)
		api.GET("/bible/versions", bibleVersionsHandler.List)
		api.GET("/bible/versions/:id/download", bibleVersionsHandler.Download)
		api.GET("/bible/provider/api-bible/versions", apiBibleHandler.ListBibles)
		api.GET("/bible/provider/api-bible/audio-bibles", apiBibleHandler.ListAudioBibles)
		api.GET("/bible/provider/api-bible/audio-bibles/:audioBibleId/chapters/:chapterId", apiBibleHandler.GetAudioChapter)
		api.GET("/bible/provider/api-bible/versions/:bibleId/export-vpl", apiBibleHandler.ExportVPL)
		api.GET("/bible/installs", auth.RequireAuth(authService), bibleVersionsHandler.ListInstalled)
		api.POST("/bible/installs", auth.RequireAuth(authService), bibleVersionsHandler.RecordInstall)
		api.POST("/private-chat/device", auth.RequireAuth(authService), privateChatHandler.RegisterDevice)
		api.GET("/private-chat/members/:id", auth.RequireAuth(authService), privateChatHandler.MemberProfile)
		api.GET("/private-chat/requests", auth.RequireAuth(authService), privateChatHandler.ListRequests)
		api.POST("/private-chat/requests", auth.RequireAuth(authService), privateChatHandler.CreateRequest)
		api.POST("/private-chat/requests/:id/respond", auth.RequireAuth(authService), privateChatHandler.RespondRequest)
		api.GET("/private-chat/contacts", auth.RequireAuth(authService), privateChatHandler.Contacts)
		api.POST("/private-chat/threads", auth.RequireAuth(authService), privateChatHandler.CreateThread)
		api.GET("/private-chat/threads", auth.RequireAuth(authService), privateChatHandler.ListThreads)
		api.GET("/private-chat/threads/:id/messages", auth.RequireAuth(authService), privateChatHandler.ListMessages)
		api.POST("/private-chat/threads/:id/messages", auth.RequireAuth(authService), privateChatHandler.SendMessage)

		authGroup := api.Group("/auth")
		{
			authGroup.POST("/register", authHandler.Register)
			authGroup.POST("/login", authHandler.Login)
			authGroup.POST("/password-reset/request", authHandler.RequestPasswordReset)
			authGroup.POST("/password-reset/confirm", authHandler.ConfirmPasswordReset)
			authGroup.GET("/me", auth.RequireAuth(authService), authHandler.Me)
			authGroup.PATCH("/password", auth.RequireAuth(authService), authHandler.ChangePassword)
		}

		adminGroup := api.Group("/admin")
		adminGroup.Use(auth.RequireRole(authService, "admin", "super_admin"))
		{
			adminGroup.GET("/healthz", adminHandler.Healthz)
			adminGroup.GET("/settings/serve", settingsHandler.AdminGetServe)
			adminGroup.PATCH("/settings/serve", settingsHandler.AdminUpdateServe)

			adminGroup.GET("/sermons", adminSermonHandler.List)
			adminGroup.POST("/sermons", adminSermonHandler.Create)
			adminGroup.POST("/sermons/import/preview", adminSermonHandler.PreviewImport)
			adminGroup.POST("/sermons/import", adminSermonHandler.Import)
			adminGroup.PATCH("/sermons/:id", adminSermonHandler.Update)
			adminGroup.DELETE("/sermons/:id", adminSermonHandler.Delete)

			adminGroup.GET("/devotions", adminDevotionHandler.List)
			adminGroup.POST("/devotions", adminDevotionHandler.Create)
			adminGroup.POST("/devotions/import/preview", adminDevotionHandler.PreviewImport)
			adminGroup.POST("/devotions/import", adminDevotionHandler.Import)
			adminGroup.PATCH("/devotions/:id", adminDevotionHandler.Update)
			adminGroup.DELETE("/devotions/:id", adminDevotionHandler.Delete)

			adminGroup.GET("/library", adminLibraryHandler.List)
			adminGroup.POST("/library", adminLibraryHandler.Create)
			adminGroup.PATCH("/library/:id", adminLibraryHandler.Update)
			adminGroup.DELETE("/library/:id", adminLibraryHandler.Delete)

			adminGroup.GET("/reading-plans", adminReadingPlanHandler.List)
			adminGroup.POST("/reading-plans", adminReadingPlanHandler.Create)
			adminGroup.PATCH("/reading-plans/:id", adminReadingPlanHandler.Update)
			adminGroup.DELETE("/reading-plans/:id", adminReadingPlanHandler.Delete)

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
			adminGroup.POST("/live-config/cloudflare/live-input", adminLiveConfigHandler.CreateCloudflareLiveInput)
			adminGroup.DELETE("/live-config/cloudflare/live-input", adminLiveConfigHandler.ResetCloudflareLiveInput)
			adminGroup.PATCH("/live-config", adminLiveConfigHandler.Update)
			adminGroup.GET("/prayers", adminPrayerHandler.List)
			adminGroup.PATCH("/prayers/:id", adminPrayerHandler.Update)
			adminGroup.POST("/media", adminMediaHandler.Upload)
			adminGroup.GET("/giving/transactions", givingHandler.ListTransactions)
			adminGroup.GET("/giving/transactions/:id/receipt.pdf", givingHandler.DownloadReceipt)
			adminGroup.GET("/giving/transactions/:id/invoice.pdf", givingHandler.DownloadInvoice)
			adminGroup.GET("/notifications/messages", notificationHandler.ListMessages)
			adminGroup.POST("/notifications/broadcast", notificationHandler.Broadcast)
			adminGroup.GET("/community/messages", communityHandler.AdminList)
			adminGroup.PATCH("/community/messages/:id", communityHandler.AdminUpdate)
			adminGroup.DELETE("/community/messages/:id", communityHandler.Delete)
			adminGroup.GET("/testimonies", testimonyHandler.AdminList)
			adminGroup.PATCH("/testimonies/:id", testimonyHandler.AdminUpdate)
			adminGroup.GET("/checkins/recent", checkinHandler.Recent)
			adminGroup.POST("/checkins/verify", checkinHandler.Verify)
		}
	}

	return r
}
