"""Every change to trusted rule data writes a ParkingDataRevision (auditable trusted data)."""

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.forms.models import model_to_dict

from .models import ParkingRestriction, ParkingRule, TemporaryClosure


def _snapshot(instance):
    data = model_to_dict(instance)
    return {
        k: (str(v) if not isinstance(v, (int, float, bool, type(None), list, dict, str)) else v)
        for k, v in data.items()
    }


def _record(instance, action):
    from apps.parking.models import ParkingDataRevision

    ParkingDataRevision.objects.create(
        area_id=instance.area_id,
        object_type=instance.__class__.__name__,
        object_id=instance.pk or 0,
        action=action,
        snapshot=_snapshot(instance),
    )


for _model in (ParkingRule, ParkingRestriction, TemporaryClosure):

    @receiver(post_save, sender=_model, weak=False)
    def _saved(sender, instance, created, **kwargs):
        if kwargs.get("raw"):
            return
        _record(instance, "created" if created else "updated")

    @receiver(post_delete, sender=_model, weak=False)
    def _deleted(sender, instance, **kwargs):
        _record(instance, "deleted")
