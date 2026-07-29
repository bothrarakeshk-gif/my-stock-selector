using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Azure.Storage.Blobs;
using System.Text;

namespace ProductSelector.Functions
{
    public class SaveSelection
    {
        private readonly ILogger _logger;

        public SaveSelection(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<SaveSelection>();
        }

        [Function("SaveSelection")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", "options", Route = "selections")] HttpRequestData req)
        {
            // CORS
            if (req.Method.ToUpper() == "OPTIONS")
            {
                var cors = req.CreateResponse(HttpStatusCode.OK);
                cors.Headers.Add("Access-Control-Allow-Origin",  "*");
                cors.Headers.Add("Access-Control-Allow-Methods", "POST, OPTIONS");
                cors.Headers.Add("Access-Control-Allow-Headers", "Content-Type");
                return cors;
            }

            var response = req.CreateResponse();
            response.Headers.Add("Access-Control-Allow-Origin", "*");

            string requestBody = await new StreamReader(req.Body).ReadToEndAsync();

            SaveSelectionRequest? payload;
            try { payload = JsonConvert.DeserializeObject<SaveSelectionRequest>(requestBody); }
            catch
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                await response.WriteStringAsync(JsonConvert.SerializeObject(new { error = "Invalid JSON body." }));
                return response;
            }

            if (string.IsNullOrWhiteSpace(payload?.Codename))
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                await response.WriteStringAsync(JsonConvert.SerializeObject(new { error = "Codename is required." }));
                return response;
            }

            string safeName = SanitiseCodename(payload.Codename);

            var record = new SelectionRecord
            {
                Codename         = payload.Codename,
                SelectedProducts = payload.SelectedProducts ?? Array.Empty<string>(),
                SavedAt          = DateTime.UtcNow
            };

            string json        = JsonConvert.SerializeObject(record, Formatting.Indented);
            string connStr     = Environment.GetEnvironmentVariable("AzureWebJobsStorage")!;
            string container   = Environment.GetEnvironmentVariable("BlobContainerName") ?? "product-selections";

            var containerClient = new BlobContainerClient(connStr, container);
            await containerClient.CreateIfNotExistsAsync();

            var blobClient = containerClient.GetBlobClient($"selections/{safeName}.json");
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(json));
            await blobClient.UploadAsync(stream, overwrite: true);

            response.StatusCode = HttpStatusCode.OK;
            response.Headers.Add("Content-Type", "application/json");
            await response.WriteStringAsync(JsonConvert.SerializeObject(new
            {
                success  = true,
                codename = payload.Codename,
                savedAt  = record.SavedAt
            }));
            return response;
        }

        private static string SanitiseCodename(string name) =>
            System.Text.RegularExpressions.Regex.Replace(name.Trim().ToLowerInvariant(), @"[^a-z0-9\-_]", "-");
    }

    public class SaveSelectionRequest
    {
        [JsonProperty("codename")]          public string?   Codename         { get; set; }
        [JsonProperty("selectedProducts")]  public string[]? SelectedProducts { get; set; }
    }

    public class SelectionRecord
    {
        [JsonProperty("codename")]          public string    Codename         { get; set; } = "";
        [JsonProperty("selectedProducts")]  public string[]  SelectedProducts { get; set; } = Array.Empty<string>();
        [JsonProperty("savedAt")]           public DateTime  SavedAt          { get; set; }
    }
}
