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
using Azure;

namespace ProductSelector.Functions
{
    /// <summary>
    /// Retrieves a previously saved product selection from Azure Blob Storage.
    /// Blob path: selections/{codename}.json
    ///
    /// Required App Settings:
    ///   AzureWebJobsStorage  — connection string for your storage account
    ///   BlobContainerName    — container name, e.g. "product-selections"
    ///
    /// GET /api/selections/{codename}
    ///
    /// Response 200:
    /// {
    ///   "codename": "my-config",
    ///   "selectedProducts": ["prod-1", "prod-3"],
    ///   "savedAt": "2026-07-29T..."
    /// }
    ///
    /// Response 404 — no saved selection for that codename.
    /// </summary>
    public static class GetSelection
    {
        [FunctionName("GetSelection")]
        public static async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", "options", Route = "selections/{codename}")] HttpRequest req,
            string codename,
            ILogger log)
        {
            log.LogInformation("GetSelection triggered for codename '{Codename}'.", codename);

            // ── CORS ──────────────────────────────────────────────────────────
            req.HttpContext.Response.Headers.Add("Access-Control-Allow-Origin",  "*");
            req.HttpContext.Response.Headers.Add("Access-Control-Allow-Methods", "GET, OPTIONS");
            req.HttpContext.Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type");

            if (req.Method == HttpMethods.Options)
                return new OkResult();

            if (string.IsNullOrWhiteSpace(codename))
                return new BadRequestObjectResult(new { error = "Codename is required." });

            string safeName = SanitiseCodename(codename);

            // ── Read from blob ────────────────────────────────────────────────
            string connStr       = Environment.GetEnvironmentVariable("AzureWebJobsStorage");
            string containerName = Environment.GetEnvironmentVariable("BlobContainerName") ?? "product-selections";

            var containerClient = new BlobContainerClient(connStr, containerName);
            string blobName     = $"selections/{safeName}.json";
            var blobClient      = containerClient.GetBlobClient(blobName);

            bool exists = await blobClient.ExistsAsync();
            if (!exists)
            {
                log.LogInformation("No selection found for codename '{Codename}'.", codename);
                return new NotFoundObjectResult(new { error = $"No saved selection found for codename '{codename}'." });
            }

            var download = await blobClient.DownloadContentAsync();
            string json  = download.Value.Content.ToString();

            SelectionRecord record;
            try
            {
                record = JsonConvert.DeserializeObject<SelectionRecord>(json);
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Failed to deserialise stored blob for codename '{Codename}'.", codename);
                return new StatusCodeResult(500);
            }

            log.LogInformation("Returning selection for '{Codename}' ({Count} products).",
                codename, record?.SelectedProducts?.Length ?? 0);

            return new OkObjectResult(record);
        }

        private static string SanitiseCodename(string name) =>
            System.Text.RegularExpressions.Regex.Replace(name.Trim().ToLowerInvariant(), @"[^a-z0-9\-_]", "-");
    }
}
