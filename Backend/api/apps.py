import logging

from django.apps import AppConfig


logger = logging.getLogger(__name__)


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        from django.conf import settings
        db = settings.DATABASES.get('default', {})
        engine = db.get('ENGINE', '')
        name = db.get('NAME', '')
        if 'sqlite' in engine:
            logger.info('Current database: SQLite | path=%s', name)
        else:
            host = db.get('HOST', '')
            port = db.get('PORT', '')
            logger.info(
                'Current database: %s | NAME=%s HOST=%s PORT=%s',
                engine.split('.')[-1] if engine else 'unknown',
                name,
                host or '(default)',
                port or '(default)',
            )
