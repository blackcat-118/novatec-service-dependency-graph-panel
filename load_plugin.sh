# yarn dev
cp -r dist custom-sdg-panel
zip -r releases/custom-sdg-panel.zip custom-sdg-panel
kubectl cp -n free5gc releases/custom-sdg-panel.zip prometheus-grafana-0:/var/lib/grafana/plugins/
rm -rf custom-sdg-panel

echo "kubectl exec -n free5gc -it prometheus-grafana-0 -- grafana cli --pluginUrl /var/lib/grafana/plugins/custom-sdg-panel.zip plugins install custom-sdg-panel"
