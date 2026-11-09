from rest_framework import serializers

from .models import HelpArticle, SupportTicket, TicketCategory


class HelpArticleSerializer(serializers.ModelSerializer):
    title = serializers.SerializerMethodField()
    body = serializers.SerializerMethodField()

    class Meta:
        model = HelpArticle
        fields = ["id", "slug", "category", "title", "body", "updated_at"]

    def _pt(self):
        req = self.context.get("request")
        lang = (req.query_params.get("lang") if req else "") or ""
        return lang.lower().startswith("pt")

    def get_title(self, o) -> str:
        return o.title_pt if self._pt() else o.title_en

    def get_body(self, o) -> str:
        return o.body_pt if self._pt() else o.body_en


class TicketSerializer(serializers.ModelSerializer):
    attachments_count = serializers.SerializerMethodField()

    class Meta:
        model = SupportTicket
        fields = [
            "id",
            "reference",
            "category",
            "description",
            "context",
            "status",
            "staff_reply",
            "attachments_count",
            "created_at",
            "updated_at",
        ]

    def get_attachments_count(self, o) -> int:
        return o.attachments.count()


class CreateTicketSerializer(serializers.Serializer):
    category = serializers.ChoiceField(choices=TicketCategory.choices)
    description = serializers.CharField(min_length=15, max_length=3000)
    contact_email = serializers.EmailField(required=False, allow_blank=True)
    include_context = serializers.BooleanField(default=False)
    context = serializers.DictField(required=False, default=dict)

    def validate_context(self, v):
        allowed = {"area_id", "session_id", "search", "app_version", "platform", "language"}
        return {k: v[k] for k in v if k in allowed}
