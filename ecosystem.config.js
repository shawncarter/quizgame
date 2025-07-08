module.exports = {
  apps: [
    {
      name: 'quizgame-server',
      cwd: './server',
      script: 'npm',
      args: 'run dev',
      watch: ['index.js', 'routes/**/*.js', 'controllers/**/*.js', 'models/**/*.js', 'services/**/*.js', 'config/**/*.js', 'middleware/**/*.js'],
      ignore_watch: ['node_modules', 'logs'],
      watch_options: {
        followSymlinks: false,
        usePolling: true
      },
      env: {
        NODE_ENV: 'development',
      },
      max_memory_restart: '500M',
      restart_delay: 3000,
      autorestart: true,
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: 5000,
      listen_timeout: 8000,
      kill_timeout: 5000,
      out_file: './logs/server-out.log',
      error_file: './logs/server-error.log',
      merge_logs: true,
      time: true,
    },
    {
      name: 'quizgame-client',
      cwd: './client',
      script: 'npm',
      args: 'run dev',
      watch: ['src/**/*.jsx', 'src/**/*.js', 'public/**/*'],
      ignore_watch: ['node_modules', 'dist', 'logs'],
      watch_options: {
        followSymlinks: false,
        usePolling: true
      },
      env: {
        NODE_ENV: 'development',
      },
      max_memory_restart: '500M',
      restart_delay: 3000,
      autorestart: true,
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: 5000,
      listen_timeout: 8000,
      kill_timeout: 5000,
      out_file: './logs/client-out.log',
      error_file: './logs/client-error.log',
      merge_logs: true,
      time: true,
    }
  ]
};
