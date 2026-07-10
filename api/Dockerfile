FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY api/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy common module (shared models, config, database)
COPY common/ /app/common/

# Copy the API service
COPY api/ /app/api/

EXPOSE 8080

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8080", "--log-level", "info"]
