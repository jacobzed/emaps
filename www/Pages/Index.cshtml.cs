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
    }

    public void OnGet()
    {

    }
}
