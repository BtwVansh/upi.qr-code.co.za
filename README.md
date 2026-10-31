# UPI Link

### Your UPI. One Link.

UPI Link is a lightweight web application for creating shareable UPI
payment pages. Enter a UPI ID to generate a scannable QR code and a
unique link that can be shared with anyone. Visitors who open that link
can view the same payment QR code and choose a supported UPI
application.

> **Project status:** Independent project. Payment-app launching and
> compatibility depend on the device, browser, installed application and
> the payment application's supported URL schemes.

```{=html}
<!-- Replace this comment with a screenshot or demo GIF once available. -->
```
```{=html}
<!-- ![UPI Link screenshot](docs/screenshot.png) -->
```
## Features

-   **UPI ID validation** before generating a payment page.
-   **UPI payment URI generation** using the recipient's UPI ID.
-   **QR code generation** for compatible UPI payment applications.
-   **Shareable payment pages** with a URL derived from the UPI ID.
-   **URL-based QR reconstruction:** the payment page rebuilds the QR
    code from the UPI ID in its route.
-   **Google Pay, PhonePe and Paytm launch options**, subject to
    platform and application support.
-   Copy the recipient's UPI ID.
-   Copy and share the payment-page URL.
-   Download the QR code as a PNG image.
-   Native sharing where the browser supports the Web Share API.
-   Responsive layouts for mobile and desktop.
-   Light and dark appearance, where implemented.
-   No application database or custom backend is required for the
    URL-based page-generation approach.

## How it works

1.  Enter a UPI ID on the homepage.
2.  Review and accept the project's disclaimer.
3.  The application validates the UPI ID and creates a UPI payment URI.
4.  A QR code is generated in the browser.
5.  The application creates a shareable payment-page URL.
6.  Anyone opening that URL can view the reconstructed QR code and
    available payment-app options.

### Example

Given this UPI ID:

``` text
ABCD@UPI
```

A corresponding payment page could look like:

``` text
https://yourdomain.com/pay/ABCD%40UPI
```

The route contains the encoded UPI ID. When the page is opened, the
application decodes the route, rebuilds the UPI payment URI and renders
the QR code. The QR image does not need to be saved in a database.

**Link availability:** A generated URL remains usable while the domain,
hosting, application and route implementation remain available. It is
not a separately stored or guaranteed permanent file.

## Payment URI and QR codes

UPI Link generates a payment URI using the standard UPI payment-link
structure. A basic example is:

``` text
upi://pay?pa=ABCD%40UPI&cu=INR
```

-   `pa` identifies the payee's UPI ID.
-   `cu` specifies the currency, typically INR.

The QR code should encode the **UPI payment URI**, not the website's
shareable URL. The website URL opens the payment page; the QR code
carries the payment details for a compatible UPI application to read.

A syntactically valid UPI ID is not proof that the ID is active,
verified or controlled by the intended recipient. Always verify the
payee details shown by the payment application before authorizing a
transaction.

## Payment application integration

The payment page provides dedicated options for:

-   Google Pay
-   PhonePe
-   Paytm

Selecting an option attempts to open the corresponding application with
the payment details prefilled, where the device, browser and application
support the required link or intent.

Compatibility is not universal:

-   Android and iOS may require different app-link or URL-scheme
    handling.
-   A browser cannot reliably determine every application installed on a
    device.
-   An application may change or restrict its supported URL schemes.
-   If an app cannot be opened, the QR code remains available to scan
    from a compatible UPI application.

Payment details must be reviewed and the payment must be authorized by
the user inside their chosen payment application. UPI Link does not
initiate or authorize payments itself.

## Technology

UPI Link is intended to run as a frontend application, with payment
pages reconstructed from URL data rather than database records.

The exact framework, QR-generation package, styling tools and routing
implementation depend on the repository's current implementation. See
the project's source files and package manifest for the authoritative
dependency list.

> **Maintainer note:** Update this section with the exact framework and
> libraries used by the repository before publishing if you want a fully
> specific technology inventory. Do not list packages that the project
> does not actually use.

## Getting started

### Prerequisites

Install the runtime and package manager required by the project's
framework. For a Node.js-based project, this will usually mean
installing a supported Node.js LTS release.

### Clone the repository

``` bash
git clone https://github.com/<your-username>/<your-repository>.git
cd <your-repository>
```

Replace the placeholder repository URL with the actual GitHub repository
URL.

### Install dependencies

Use the package manager that matches the lockfile in the repository:

``` bash
npm install
```

If the repository uses another package manager, use its corresponding
install command instead.

### Run locally

For a typical npm-based development setup:

``` bash
npm run dev
```

Open the local URL printed by the development server, commonly:

``` text
http://localhost:3000
```

The exact commands are determined by the scripts in `package.json`.
Check that file if these example commands do not match the project.

## Project structure

The exact directory structure depends on the framework and current
repository. Common areas in a frontend project may include:

  Area                 Responsibility
  -------------------- --------------------------------------------------------
  Application routes   Homepage and dynamic payment-page routes
  Components           Input, disclaimer, QR display and payment controls
  Utilities            UPI validation, URI construction and platform handling
  Public assets        Static icons, images and other public files
  Styles               Global styles, themes and responsive presentation

Refer to the repository itself for the authoritative file and directory
structure.

## Permanent payment links

Payment pages are reconstructed from the UPI ID encoded in the URL. This
avoids needing a database to save every generated QR code.

For example:

``` text
/pay/ABCD%40UPI
```

When this route loads, the application should:

1.  Read the route parameter.
2.  Decode and validate the UPI ID.
3.  Construct the UPI payment URI.
4.  Generate the QR code.
5.  Render the recipient's payment page.

The hosting platform must support direct navigation to the dynamic
route. Test a copied payment URL in a fresh browser tab and refresh it
to confirm that the host serves the application correctly.

## Privacy and security

UPI Link is designed not to maintain an application database or
intentionally store submitted UPI IDs.

Keep the following points in mind:

-   No user account is required for the URL-based workflow.
-   The UPI ID is part of the generated payment-page URL.
-   URLs may appear in browser history, shared messages, screenshots,
    referrer data or technical hosting logs.
-   Hosting providers, browsers and network infrastructure may retain
    technical logs according to their own policies.
-   Never enter or share a UPI PIN, OTP, banking password or other
    payment authentication secret on this website.
-   Treat the UPI ID in a URL as untrusted input and validate it before
    constructing a payment URI.
-   Verify the recipient and amount inside the payment application
    before authorizing payment.

## Disclaimer

UPI Link is an independent project intended to generate UPI payment QR
codes and shareable payment pages. It is not affiliated with, endorsed
by or operated by the National Payments Corporation of India (NPCI),
Google Pay, PhonePe, Paytm or any bank.

UPI Link does not hold funds, process transactions, authorize payments,
verify ownership of UPI IDs or guarantee that a UPI ID is active.
Payment processing and authorization take place through third-party
payment applications and their respective payment networks.

Users are responsible for checking that the UPI ID and recipient details
are correct before sharing a payment page or authorizing a transaction.
The project maintainers are not responsible for incorrect details
entered by users, payments sent to unintended recipients, failed
transactions, or issues with third-party applications or services.

## Deployment

Deploy the application to a hosting provider that supports the framework
and routing strategy used by the repository.

### Deployment checklist

-   Connect the GitHub repository to the hosting provider.
-   Select the correct framework preset, build command and output
    settings.
-   Configure any required environment variables (if the project uses
    them).
-   Confirm that the homepage loads.
-   Open a generated `/pay/...` URL directly in a new tab.
-   Refresh a generated payment page and confirm that it still loads.
-   Test the generated link on a second device.
-   Test payment-app links on supported Android and iOS devices.

For a Next.js application, a platform such as Vercel can support dynamic
routes without requiring a separate database. Follow the hosting
provider's current Next.js deployment instructions and verify the
deployed route behaviour.

## Contributing

Contributions, bug reports and suggestions are welcome.

1.  Fork the repository.

2.  Create a feature branch:

    ``` bash
    git checkout -b feature/your-change
    ```

3.  Make your changes.

4.  Run the available checks and test the relevant user flows.

5.  Commit your changes:

    ``` bash
    git commit -m "Describe your change"
    ```

6.  Push your branch and open a pull request.

For significant changes, open an issue first to discuss the proposed
approach.

## License

No license is specified in this README. Check the repository for a
`LICENSE` file and add the applicable license information here once the
project owner has selected and added one.

Unless a license is included in the repository, do not assume that
others have permission to use, modify or distribute the code.

## Acknowledgements

-   The UPI ecosystem and the payment applications that support UPI
    payments.
-   The maintainers of the open-source libraries used by this project.
-   Contributors and users who report issues and help improve the
    application.

Google Pay, PhonePe, Paytm, UPI and related names and marks belong to
their respective owners. Their names are used only to identify
compatible third-party payment applications and services.
