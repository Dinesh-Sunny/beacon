import * as migration_20261002_174056_initial from './20261002_174056_initial';
import * as migration_20261003_024509_jobs from './20261003_024509_jobs';
import * as migration_20261003_033533_agent_threads_task from './20261003_033533_agent_threads_task';
import * as migration_20261003_113128_site_blocks from './20261003_113128_site_blocks';
import * as migration_20261003_120121_privacy_audit_tasks from './20261003_120121_privacy_audit_tasks';
import * as migration_20261003_125622_tenancy from './20261003_125622_tenancy';
import * as migration_20261003_135059_commerce from './20261003_135059_commerce';

export const migrations = [
  {
    up: migration_20261002_174056_initial.up,
    down: migration_20261002_174056_initial.down,
    name: '20261002_174056_initial',
  },
  {
    up: migration_20261003_024509_jobs.up,
    down: migration_20261003_024509_jobs.down,
    name: '20261003_024509_jobs',
  },
  {
    up: migration_20261003_033533_agent_threads_task.up,
    down: migration_20261003_033533_agent_threads_task.down,
    name: '20261003_033533_agent_threads_task',
  },
  {
    up: migration_20261003_113128_site_blocks.up,
    down: migration_20261003_113128_site_blocks.down,
    name: '20261003_113128_site_blocks',
  },
  {
    up: migration_20261003_120121_privacy_audit_tasks.up,
    down: migration_20261003_120121_privacy_audit_tasks.down,
    name: '20261003_120121_privacy_audit_tasks',
  },
  {
    up: migration_20261003_125622_tenancy.up,
    down: migration_20261003_125622_tenancy.down,
    name: '20261003_125622_tenancy',
  },
  {
    up: migration_20261003_135059_commerce.up,
    down: migration_20261003_135059_commerce.down,
    name: '20261003_135059_commerce'
  },
];
