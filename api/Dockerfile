# Zpot API — development & CI image. GeoDjango needs GDAL/GEOS/PROJ system libraries.
FROM python:3.13-slim-trixie

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends binutils gdal-bin libgdal-dev libgeos-dev libproj-dev curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements/ /app/requirements/
ARG REQUIREMENTS=dev
RUN pip install -r requirements/${REQUIREMENTS}.txt

COPY . /app

RUN useradd --create-home --uid 1000 zpot && chown -R zpot:zpot /app
USER zpot

EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -fsS http://localhost:8000/api/v1/health/ || exit 1

CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py runserver 0.0.0.0:8000"]
