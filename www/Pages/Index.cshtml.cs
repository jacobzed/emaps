using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace EMapper.Pages;

public class IndexModel : PageModel
{
    private readonly ILogger<IndexModel> _logger;

    public string MapsApiKey { get; set; }

    public IndexModel(ILogger<IndexModel> logger, IConfiguration config)
    {
        _logger = logger;

        MapsApiKey = config["Secrets:MapsApiKey"] ?? "";
        if (String.IsNullOrEmpty(MapsApiKey))
            Console.Error.WriteLine("MapsApiKey is not set. Please set the MapsApiKey in appsettings.json.");
    }

    public void OnGet()
    {

    }
}
