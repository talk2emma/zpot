import logging

from celery import shared_task

from .quality import run_checks

log = logging.getLogger("zpot.quality")


@shared_task
def data_quality_check():
    r = run_checks()
    for i in r["issues"]:
        (log.warning if i["severity"] in ("high", "medium") else log.info)(
            "data-quality %s count=%s", i["code"], i["count"]
        )
    return r
