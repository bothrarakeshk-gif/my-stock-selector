using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Azure.Storage.Blobs;
using System.Text;

namespace ProductSelector.Functions
{
    /// <summary>
    /// Saves the current product selection (codename + selected product IDs) to Azure Blob Storage.
    /// Blob path: selections/{codename}.json
    ///
    /// Required App Settings:
    ///   AzureWebJobsStorage  — connection string for your storage account
    ///   BlobContainerName    — container name, e.g. "product-selections"
    ///
    /// Request body (JSON):
    /// {
    ///   "codename": "my-config",
    ///   "selectedProducts": ["prod-1", "prod-3", "prod-7"]
    /// }
    ///
    /// Response (200 OK):
    /// { "success": true, "codename": "my-config", "savedAt": "2026-07-29T..." }
    /// </summary>
    public static class SaveSelection
    {
        [FunctionName("SaveSelection")]
        public static async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "selections")] HttpRequest req,
            ILogger log)
        {
            log.LogInformation("SaveSelection triggered.");

            // ── CORS ──────────────────────────────────────────────────────────
            req.HttpContext.Response.Headers.Add("Access-Control-Allow-Origin",  "*");
            req.HttpContext.Response.Headers.Add("Access-Control-Allow-Methods", "POST, OPTIONS");
            req.HttpContext.Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type");

            if (req.Method == HttpMethods.Options)
                return new OkResult();

            // ── Parse body ────────────────────────────────────────────────────
            string requestBody;
            using (var reader = new StreamReader(req.Body))
                requestBody = await reader.ReadToEndAsync();

            SaveSelectionRequest payload;
            try
            {
                payload = JsonConvert.DeserializeObject<SaveSelectionRequest>(requestBody);
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Failed to deserialise request body.");
                return new BadRequestObjectResult(new { error = "Invalid JSON body." });
            }

            if (string.IsNullOrWhiteSpace(payload?.Codename))
                return new BadRequestObjectResult(new { error = "Codename is required." });

            // Sanitise codename so it is safe as a blob name
            string safeName = SanitiseCodename(payload.Codename);

            // ── Build payload to store ────────────────────────────────────────
            var record = new SelectionRecord
            {
                Codename         = payload.Codename,
                SelectedProducts = payload.SelectedProducts ?? Array.Empty<string>(),
                SavedAt          = DateTime.UtcNow
            };

            string json = JsonConvert.SerializeObject(record, Formatting.Indented);

            // ── Write to blob ─────────────────────────────────────────────────
            string connStr       = Environment.GetEnvironmentVariable("AzureWebJobsStorage");
            string containerName = Environment.GetEnvironmentVariable("BlobContainerName") ?? "product-selections";

            var containerClient = new BlobContainerClient(connStr, containerName);
            await containerClient.CreateIfNotExistsAsync();

            string blobName = $"selections/{safeName}.json";
            var blobClient  = containerClient.GetBlobClient(blobName);

            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(json));
            await blobClient.UploadAsync(stream, overwrite: true);

            log.LogInformation("Saved selection '{Codename}' → blob '{BlobName}'.", payload.Codename, blobName);

            return new OkObjectResult(new
            {
                success  = true,
                codename = payload.Codename,
                savedAt  = record.SavedAt
            });
        }

        // Replace characters that are invalid in blob names
        private static string SanitiseCodename(string name) =>
            System.Text.RegularExpressions.Regex.Replace(name.Trim().ToLowerInvariant(), @"[^a-z0-9\-_]", "-");
    }

    // ── DTOs ──────────────────────────────────────────────────────────────────

    public class SaveSelectionRequest
    {
        [JsonProperty("codename")]
        public string Codename { get; set; }

        [JsonProperty("selectedProducts")]
        public string[] SelectedProducts { get; set; }
    }

    public class SelectionRecord
    {
        [JsonProperty("codename")]
        public string Codename { get; set; }

        [JsonProperty("selectedProducts")]
        public string[] SelectedProducts { get; set; }

        [JsonProperty("savedAt")]
        public DateTime SavedAt { get; set; }
    }
}
