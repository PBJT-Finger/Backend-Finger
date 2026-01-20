/**
 * PM2 Ecosystem Configuration
 * Production-ready cluster mode with monitoring
 */

module.exports = {
    apps: [{
        name: 'finger-api',
        script: 'src/server.js',

        // Cluster mode - use all CPU cores
        instances: 'max',
        exec_mode: 'cluster',

        // Environment
        env: {
            NODE_ENV: 'development',
            PORT: 3000
        },
        env_production: {
            NODE_ENV: 'production',
            PORT: 3000
        },

        // Memory management
        max_memory_restart: '500M',

        // Logging
        error_file: 'logs/pm2-error.log',
        out_file: 'logs/pm2-out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,

        // Restart strategy
        max_restarts: 10,
        min_uptime: '10s',
        autorestart: true,

        // Graceful reload
        kill_timeout: 5000,
        wait_ready: true,
        listen_timeout: 10000,

        // Monitoring
        instances: 4,
        instance_var: 'INSTANCE_ID',

        // Cron restart (optional - restart at 3 AM daily)
        // cron_restart: '0 3 * * *',

        // Watch & ignore
        watch: false,
        ignore_watch: ['node_modules', 'logs', 'tests']
    }],

    // Deployment configuration
    deploy: {
        production: {
            user: 'deploy',
            host: ['production-server-1', 'production-server-2'],
            ref: 'origin/main',
            repo: 'git@github.com:username/backend-finger.git',
            path: '/var/www/finger-api',
            'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
        },
        staging: {
            user: 'deploy',
            host: 'staging-server',
            ref: 'origin/develop',
            repo: 'git@github.com:username/backend-finger.git',
            path: '/var/www/finger-api-staging',
            'post-deploy': 'npm install && pm2 reload ecosystem.config.js'
        }
    }
};
