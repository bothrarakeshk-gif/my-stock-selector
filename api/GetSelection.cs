using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Azure.Storage.Blobs;

namespace ProductSelector.Functions
{
    public class GetSelection
    {
        private readonly ILogger _logger;

        public GetSelection(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<GetSelection>();
        }

        [Function("GetSelection")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", "options", Route = "selections/{codename}")] HttpRequestData req,
            string codename)
        {
            // CORS
            if (req.Method.ToUpper() == "OPTIONS")
            {
                var cors = req.CreateResponse(HttpStatusCode.OK);
                cors.Headers.Add("Access-Control-Allow-Origin",  "*");
                cors.Headers.Add("Access-Control-Allow-Methods", "GET, OPTIONS");
                cors.Headers.Add("Access-Control-Allow-Headers", "Content-Type");
                return cors;
            }

            var response = req.CreateResponse();
            response.Headers.Add("Access-Control-Allow-Origin", "*");
            response.Headers.Add("Content-Type", "application/json");

            if (string.IsNullOrWhiteSpace(codename))
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                await response.WriteStringAsync(JsonConvert.SerializeObject(new { error = "Codename is required." }));
                return response;
            }

            string safeName    = SanitiseCodename(codename);
            string connStr     = Environment.GetEnvironmentVariable("AzureWebJobsStorage")!;
            string container   = Environment.GetEnvironmentVariable("BlobContainerName") ?? "product-selections";

            var containerClient = new BlobContainerClient(connStr, container);
            var blobClient      = containerClient.GetBlobClient($"selections/{safeName}.json");

            if (!await blobClient.ExistsAsync())
            {
                response.StatusCode = HttpStatusCode.NotFound;
                await response.WriteStringAsync(JsonConvert.SerializeObject(new { error = $"No saved selection found for '{codename}'." }));
                return response;
            }

            var download = await blobClient.DownloadContentAsync();
            string json  = download.Value.Content.ToString();

            response.StatusCode = HttpStatusCode.OK;
            await response.WriteStringAsync(json);
            return response;
        }

        private static string SanitiseCodename(string name) =>
            System.Text.RegularExpressions.Regex.Replace(name.Trim().ToLowerInvariant(), @"[^a-z0-9\-_]", "-");
    }
}
