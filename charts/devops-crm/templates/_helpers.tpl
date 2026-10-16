{{/* Resource name prefix: the release name, e.g. "crm" → crm-backend, crm-frontend. */}}
{{- define "crm.fullname" -}}
{{- default .Release.Name .Values.fullnameOverride | trunc 40 | trimSuffix "-" -}}
{{- end -}}

{{- define "crm.selectorLabels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/* Usage: include "crm.labels" (dict "ctx" $ "component" "backend") */}}
{{- define "crm.labels" -}}
{{ include "crm.selectorLabels" .ctx }}
app.kubernetes.io/component: {{ .component }}
app.kubernetes.io/part-of: devops-crm
app.kubernetes.io/version: {{ include "crm.tag" (dict "ctx" .ctx "image" dict) | quote }}
app.kubernetes.io/managed-by: {{ .ctx.Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .ctx.Chart.Name .ctx.Chart.Version }}
{{- end -}}

{{- define "crm.componentSelector" -}}
{{ include "crm.selectorLabels" .ctx }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{/* Image tag: component override, then the shared imageTag. One of them is required. */}}
{{- define "crm.tag" -}}
{{- .image.tag | default .ctx.Values.imageTag | required "Set imageTag (CD passes the commit SHA)" -}}
{{- end -}}

{{- define "crm.image" -}}
{{- printf "%s:%s" .image.repository (include "crm.tag" .) -}}
{{- end -}}

{{- define "crm.databaseSecret" -}}
{{- if .Values.postgresql.enabled -}}
{{- .Values.postgresql.auth.existingSecret | default (printf "%s-database" (include "crm.fullname" .)) -}}
{{- else -}}
{{- .Values.externalDatabase.existingSecret | required "Set externalDatabase.existingSecret when postgresql.enabled=false" -}}
{{- end -}}
{{- end -}}

{{- define "crm.backendEnv" -}}
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: {{ include "crm.databaseSecret" . }}
      key: DATABASE_URL
{{- end -}}

{{- define "crm.podSecurityContext" -}}
{{ toYaml .Values.podSecurityContext }}
{{- end -}}

{{- define "crm.containerSecurityContext" -}}
{{ toYaml .Values.containerSecurityContext }}
{{- end -}}
