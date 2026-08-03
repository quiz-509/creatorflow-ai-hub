SELECT jobname, schedule, command FROM cron.job WHERE jobname LIKE '%heartbeat%' ORDER BY jobname;
